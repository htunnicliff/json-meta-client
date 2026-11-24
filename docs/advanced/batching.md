# Batching

JMAP lets a client send many method calls in one HTTP request. The client
does this for you: method calls that you make together travel together, so
related work costs one round trip instead of several.

## How batching works

Each method call joins a queue instead of being sent right away. Once the
code that is running finishes its synchronous work, the client sends
everything in the queue as one JMAP request, in a
[microtask](https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide).

These two calls are made in the same synchronous turn, so they share one
request:

```ts
const [inboxes, identities] = await Promise.all([
  client.api.Mailbox.query({ filter: { role: "inbox" } }),
  client.api.Identity.get({}),
]);
```

A few rules follow from sending the queue in a microtask:

- **An `await` closes the batch.** A call made after an `await` runs in a
  later turn, after the earlier batch has left, so it goes in a separate
  request.
- **A batch in flight is closed.** A call made while an earlier request is
  still waiting for its response starts a new request. It doesn't wait for
  the earlier one to finish.
- **References stay inside a batch.** A result reference can only point at
  a method call earlier in the same batch. A call that references one from
  another batch is rejected with `ResultReferenceError` and is not sent.

Before the first batch goes out, the client loads the session, which it then
caches. The client also fills in each call's default `accountId` when the
batch is sent, so a call made before the session has loaded still gets one.

## Writing batch-friendly code

To get the most from batching, create the calls you need together, and
await only the results you use. A call whose result only feeds a result
reference needs no `await` at all:

```ts
const recent = client.api.Email.query({
  filter: { inMailbox: "<inboxId>" },
  sort: [{ property: "receivedAt", isAscending: false }],
  limit: 10,
});

const { list: recentEmails } = await client.api.Email.get({
  ids: recent.resultRef("/ids"),
  properties: ["subject", "from", "receivedAt"],
});
```

When you don't need a call's result, you may prefix the statement with `void` to
show that the promise is discarded on purpose. Here, marking an email as
read rides along with the request that fetches it:

```ts
void client.api.Email.set({
  update: { "<emailId>": { "keywords/$seen": true } },
});

const { list: openedEmails } = await client.api.Email.get({
  ids: ["<emailId>"],
  properties: ["subject", "bodyValues"],
  fetchAllBodyValues: true,
});
```

The pattern to avoid is awaiting each call in turn. Every `await` closes the
batch, so this code makes three round trips where one would do:

```ts
// Three requests, one after another
const mailboxQuery = await client.api.Mailbox.query({});
const mailboxGet = await client.api.Mailbox.get({
  ids: mailboxQuery.ids,
});
const identityGet = await client.api.Identity.get({});
```

The batched version makes the same calls in one request. The second call
reads the first call's IDs through a result reference instead of waiting
for them:

```ts
const allMailboxes = client.api.Mailbox.query({});

const [mailboxes, senders] = await Promise.all([
  client.api.Mailbox.get({
    ids: allMailboxes.resultRef("/ids"),
  }),
  client.api.Identity.get({}),
]);
```

Use `Promise.all` when you need several results, as above. When you need
only one, await that one call; the others are sent with it either way.

## Limits

Servers limit the size of a request. The core capability's session details
include `maxCallsInRequest`, the most method calls in one request, and
`maxSizeRequest`, the largest request body in bytes. A request over either
limit fails as a whole: the server answers with a request-level `limit`
error, and every call in the batch rejects with an `HttpError`.

## Failure behavior

Because a batch is one HTTP request, a failure of the request itself fails
every call in it. A failure of one method call fails only that call:

| What failed                                                                     | Calls that reject       | Error                                          |
| ------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------- |
| Loading the session, the network, an HTTP error status, or reading the response | Every call in the batch | The same error for each, such as `HttpError`   |
| A `beforeJmapRequest` or `afterJmapResponse` [hook](./hooks.md#errors-in-hooks) | Every call in the batch | The error the hook threw                       |
| A method call, answered with an `error` response                                | Only that call          | `JmapError`                                    |
| A call that breaks a result reference rule, or has no clear default account     | Only that call          | `ResultReferenceError` or `ConfigurationError` |

A call rejected before the request is sent, as in the last row, is left out
of the request, and the rest of the batch goes ahead without it. A batch
that fails doesn't affect later batches: the next calls you make are sent
normally.

See the [errors reference](../reference/errors.md) for each error class.

## Matching responses

The server answers with one or more responses per method call, each tagged
with the call's ID. The client matches each response to its call by that
ID, not by position.

If no response carries a call's ID, or the only responses with it are for a
different method, the call rejects with `MethodCallError`.

::: info
Some methods produce more than one response under the same ID. For example,
an `EmailSubmission/set` call with `onSuccessDestroyEmail` also returns an
implicit `Email/set` response for the emails it destroyed. Among the
responses that share a call's ID, the client settles the call with the one
named after its method, or with an `error` response, and ignores the rest.
:::

## Cancelling

`client.cancelBatch()` rejects every call still waiting in the current batch
with `CancellationError`, and that batch is never sent. Because a batch is
sent as soon as the current synchronous work finishes, only calls made in the
same turn can be cancelled:

```ts
import { CancellationError } from "json-meta-client";

const draftSearch = client.api.Email.query({
  filter: { text: "<search terms>" },
});

// The search terms turned out to be empty; drop the batch
client.cancelBatch();

await draftSearch.catch((error: unknown) => {
  if (!(error instanceof CancellationError)) throw error;
});
```

A request that has already been sent is not aborted, and its calls settle
normally. Cancelling doesn't stop the client either: calls made after
`cancelBatch()` go in a new batch as usual.

## Isolated queues

All calls made through `client.api` share one queue, so `cancelBatch()`
affects all of them. `client.isolated()` gives you an API with a queue of its
own:

```ts
const sidebar = client.isolated((api) => {
  const folders = api.Mailbox.query({
    sort: [{ property: "sortOrder" }],
  });

  return api.Mailbox.get({
    ids: folders.resultRef("/ids"),
    properties: ["name", "unreadEmails"],
  });
});

const { list: sidebarMailboxes } = await sidebar;
```

The callback receives:

- `api`, which works like `client.api`, with the same capabilities and
  types. Calls made through it are batched together, separately from calls
  made through `client.api` or any other isolated API, even in the same
  turn.
- `cancel`, which works like `client.cancelBatch()` but only for this queue.
  Calling `client.cancelBatch()` doesn't affect it.

`isolated()` returns whatever the callback returns, unchanged. Return a
pending call, an object of several, or the promise of an `async` callback.
An `async` callback can keep using `api` and `cancel` after an `await`, with
the same batching rules as `client.api`.

Isolated queues help when separate parts of an app make calls on their own
schedule, such as separate views in a UI. Each part can cancel its own
pending calls without discarding another part's. Keep in mind that each
queue sends its own requests, so calls that could share a request are best
made through the same API.
