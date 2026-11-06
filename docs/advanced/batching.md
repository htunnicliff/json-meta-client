# Group calls into requests

The client queues method calls and flushes that queue in the next microtask.
Calls created together on the same API instance therefore travel in one JMAP
HTTP request, in the order you created them. This saves round trips, but does
not make the calls a transaction.

## Group independent work

Create independent calls before awaiting either of them. JavaScript evaluates
both method calls below before `Promise.all` waits, so they share a batch:

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail"],
});

const [mailboxes, unread] = await Promise.all([
  client.api.Mailbox.get({
    accountId: "ACCOUNT_ID",
    ids: null,
    properties: ["id", "name"],
  }),
  client.api.Email.query({
    accountId: "ACCOUNT_ID",
    filter: { notKeyword: "$seen" },
    limit: 10,
  }),
]);
console.log(mailboxes.list, unread.ids);
```

`Promise.all` is not what schedules the batch. Creating the calls synchronously
keeps them together. Awaiting the first call before creating the second yields
to the queue and produces separate requests. Other asynchronous boundaries can
also allow a flush, even before any HTTP request has started.

Unrelated users of `client.api` can contribute calls to the same batch. A later
batch can also start while an earlier request is in flight; the client does not
serialise all requests.

## Keep dependent calls together

When one call needs another's result, use a
[result or creation reference](../features/method-calls.md#reference-a-previous-result).
Queue the producer before the consumer, without awaiting between them, and keep
both on the same API queue.

References do not connect different HTTP requests. The client does not track a
dependency graph, move calls between queues, or substitute a completed result.
If the producer has already run, use its returned IDs as ordinary values.

## Give an operation its own queue

Use `isolated()` when an operation should not share the main queue. Its callback
receives a fresh `api` and a cancellation function. Use that `api` for every call
you want in the isolated batch:

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail"],
});

const mailboxes = await client.isolated(async (api) => {
  const query = api.Mailbox.query({
    accountId: "ACCOUNT_ID",
    filter: { role: "inbox" },
    limit: 1,
  });
  const get = api.Mailbox.get({
    accountId: "ACCOUNT_ID",
    ids: query.resultRef("/ids"),
    properties: ["id", "name"],
  });
  const [, result] = await Promise.all([query, get]);
  return result;
});
console.log(mailboxes.list);
```

The isolated API shares the client's session, authentication, hooks, and
middleware. `isolated()` invokes the callback synchronously and returns exactly
what it returns, including a promise. Returning or throwing from the callback
does not cancel queued work. Calls made through `client.api` inside the callback
still use the main queue.

## Split work to fit the server's limits

The client sends the whole flushed queue. It does not split oversized requests,
enforce advertised limits, or retry rejected batches. Read these limits from
`session.capabilities["urn:ietf:params:jmap:core"]` before planning a large
operation:

| Limit                                | What you need to bound             |
| ------------------------------------ | ---------------------------------- |
| `maxCallsInRequest`                  | Method calls in one request.       |
| `maxSizeRequest`                     | Bytes in the encoded request.      |
| `maxObjectsInGet`, `maxObjectsInSet` | Objects in each get or set call.   |
| `maxConcurrentRequests`              | Requests running at the same time. |

This example reads a known list of IDs in sequential chunks. Each isolated
request has one get, so it cannot combine with unrelated main-queue work:

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail"],
});
const core = (await client.session).capabilities[
  "urn:ietf:params:jmap:core"
];
if (
  !core ||
  core.maxObjectsInGet < 1 ||
  core.maxCallsInRequest < 1
) {
  throw new Error(
    "The server did not advertise usable request limits",
  );
}

const ids = ["EMAIL_ID_1", "EMAIL_ID_2"];
const size = core.maxObjectsInGet;
for (let offset = 0; offset < ids.length; offset += size) {
  const result = await client.isolated((api) =>
    api.Email.get({
      accountId: "ACCOUNT_ID",
      ids: ids.slice(offset, offset + size),
      properties: ["id", "subject"],
    }),
  );
  console.log(result.list, result.notFound);
}
```

The example assumes these small ID lists fit `maxSizeRequest`; object counts
alone do not bound request bytes. Keep reference chains within one request and
within the call limit. If a chain cannot fit, run its producer first and pass
concrete IDs to the next request instead of a reference.

## Cancel calls that are still queued

Call `client.cancelBatch()` to reject every call still queued on the main API.
Inside `isolated()`, use the supplied `cancel()` to affect only that queue.
Cancellation must happen before the queue flushes:

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: [],
});

const outcomes = await client.isolated((api, cancel) => {
  const first = api.Core.echo({ message: "first" });
  const second = api.Core.echo({ message: "second" });
  const settled = Promise.allSettled([first, second]);
  cancel();
  return settled;
});
console.log(outcomes); // Both calls rejected with CancellationError.
```

Cancellation clears the whole pending queue, including siblings. Attach
rejection handlers to every call, as `Promise.allSettled` does here. Once a
flush removes calls from the queue, cancellation cannot affect them, even while
they wait for the session or a response. It does not abort fetches, undo writes,
cancel blob transfers, or close subscriptions.

Each queue's cancellation function is one-shot. Its first invocation clears the
pending queue; later invocations do nothing. Calls created after cancellation
can still run. Use a fresh `isolated()` scope for each independently cancellable
operation.

## Observe all outcomes when necessary

A method error rejects that method's promise while successful siblings can
resolve. `Promise.all` rejects on the first failure without cancelling siblings;
use `Promise.allSettled` when you need every outcome. A failure of the session,
transport, HTTP request, or envelope processing rejects every unsettled call in
the batch. Per-object set failures remain in fulfilled results. See the
[error reference](../reference/errors.md).
