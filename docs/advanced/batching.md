# Batching

The client groups method calls queued on the same API instance before its next
microtask flush. Each group becomes one JMAP HTTP request, in call order.
Batching reduces round trips; it does not make calls transactional.

## Group independent calls

Create independent calls before awaiting them:

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  auth: { token: "YOUR_ACCESS_TOKEN" },
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  capabilities: ["mail", "submission"],
});
const session = await client.session;
const accountId =
  session.primaryAccounts["urn:ietf:params:jmap:mail"];
if (
  !accountId ||
  !session.accounts[accountId]?.accountCapabilities[
    "urn:ietf:params:jmap:mail"
  ]
) {
  throw new Error("No primary mail account is available");
}

const [mailboxes, unread] = await Promise.all([
  client.api.Mailbox.get({
    accountId,
    ids: null,
    properties: ["id", "name"],
  }),
  client.api.Email.query({
    accountId,
    filter: { notKeyword: "$seen" },
    limit: 10,
  }),
]);
console.log(mailboxes.list, unread.ids);
```

`Promise.all` does not itself schedule batching: JavaScript evaluates both calls
synchronously before yielding. `await client.api.Mailbox.get(...)` followed by
`await client.api.Email.query(...)` yields between creations, so these go into
separate requests. An asynchronous boundary can allow the queue to flush even
when the network request has not started yet. Calls from unrelated consumers of
`client.api` may share a batch. A later flush may run while an earlier request
is still in flight; the client does not serialise all requests.

A method error rejects that call, while successful siblings can resolve.
`Promise.all` rejects on its first failure and does not cancel the other calls;
use `Promise.allSettled` to inspect all outcomes. A session, transport, HTTP, or
request-processing failure rejects every unsettled call in that batch.
Per-object `set` failures remain in the resolved result. See
[Errors](../reference/errors.md).

## Keep dependencies together

Use `resultRef()` or `createdRef()` when a consumer depends on a prior call in
the same request. Queue producer and consumer synchronously, then await both.

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  auth: { token: "YOUR_ACCESS_TOKEN" },
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  capabilities: ["mail", "submission"],
});
const session = await client.session;
const accountId =
  session.primaryAccounts["urn:ietf:params:jmap:mail"];
if (
  !accountId ||
  !session.accounts[accountId]?.accountCapabilities[
    "urn:ietf:params:jmap:mail"
  ]
) {
  throw new Error("No primary mail account is available");
}

const query = client.api.Email.query({
  accountId,
  limit: 10,
});
const get = client.api.Email.get({
  accountId,
  ids: query.resultRef("/ids"),
  properties: ["id", "subject"],
});
const [, emails] = await Promise.all([query, get]);
console.log(emails.list, emails.notFound);
```

A result reference cannot reach into a previous HTTP request. The client does not
track dependency graphs, move producers between queues, or substitute a completed
result. Do not mix references between `client.api` and an isolated API. Once a
producer has been awaited in another request, use its literal returned IDs instead.
The server enforces reference validity under
[RFC 8620 §3.7](https://jmap.io/spec/rfc8620/#section-3.7).
See [Method Calls](../features/method-calls.md) for pointer paths and creation references.

## Respect server limits and split work

The current client **does not split requests automatically**, enforce server
limits, or retry rejected work. It sends the whole flushed queue. Read the core
session capability for `maxCallsInRequest`, `maxSizeRequest`, `maxObjectsInGet`,
and `maxObjectsInSet`. `maxConcurrentRequests` also matters if several queues run
in parallel. Servers enforce these limits under
[RFC 8620 §2](https://jmap.io/spec/rfc8620/#section-2).

Split independent work into bounded groups yourself. Keep each dependency chain
within one request and within `maxCallsInRequest`; if it cannot fit, await the
producer in an earlier request and pass its concrete IDs. Also bound object
counts and request bytes; limiting method count alone is insufficient.

This reads literal IDs in sequential, isolated requests, each containing one
`get`. Replace `EMAIL_ID_1` and `EMAIL_ID_2` with IDs from the selected account.

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  auth: { token: "YOUR_ACCESS_TOKEN" },
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  capabilities: ["mail", "submission"],
});
const session = await client.session;
const accountId =
  session.primaryAccounts["urn:ietf:params:jmap:mail"];
if (
  !accountId ||
  !session.accounts[accountId]?.accountCapabilities[
    "urn:ietf:params:jmap:mail"
  ]
) {
  throw new Error("No primary mail account is available");
}

const ids = ["EMAIL_ID_1", "EMAIL_ID_2"];
const core =
  session.capabilities["urn:ietf:params:jmap:core"];
const size = core?.maxObjectsInGet;
if (
  !size ||
  size < 1 ||
  !core ||
  core.maxCallsInRequest < 1
) {
  throw new Error(
    "The server does not advertise usable request limits",
  );
}
for (let offset = 0; offset < ids.length; offset += size) {
  const pageIds = ids.slice(offset, offset + size);
  // Await each request to avoid exceeding the concurrency limit.
  const result = await client.isolated((api) =>
    api.Email.get({
      accountId,
      ids: pageIds,
      properties: ["id", "subject"],
    }),
  );
  console.log(result.list, result.notFound);
}
```

The small example assumes these ID lists fit `maxSizeRequest`; production callers
must also keep the encoded body below that limit. Neither a single oversized
`get` nor a two-call reference chain is rewritten by the library.

## Isolate a queue

`client.isolated(fn)` supplies a fresh API proxy with its own queue and cancellation
callback. It uses the client's session, authentication, hooks, and middleware.
It returns exactly the callback's return value, including a promise. Every call
on the supplied `api` shares that isolated queue; using `client.api` inside the
callback instead uses the main queue.

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  auth: { token: "YOUR_ACCESS_TOKEN" },
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  capabilities: ["mail", "submission"],
});
const session = await client.session;
const accountId =
  session.primaryAccounts["urn:ietf:params:jmap:mail"];
if (
  !accountId ||
  !session.accounts[accountId]?.accountCapabilities[
    "urn:ietf:params:jmap:mail"
  ]
) {
  throw new Error("No primary mail account is available");
}

const result = await client.isolated(async (api) => {
  const query = api.Mailbox.query({
    accountId,
    filter: { role: "inbox" },
    limit: 1,
  });
  const get = api.Mailbox.get({
    accountId,
    ids: query.resultRef("/ids"),
    properties: ["id", "name"],
  });
  const [, mailboxes] = await Promise.all([query, get]);
  return mailboxes;
});
console.log(result.list);
```

## Cancel queued work

`client.cancelBatch()` clears **all calls still queued** on the main API.
The cancellation callback supplied to `isolated` clears only that isolated queue.
Every removed call rejects with `CancellationError`, including siblings that did
not request cancellation. Attach rejection handlers to all siblings, for example
with `Promise.allSettled`.

Cancel synchronously before yielding, while the calls are still queued:

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  auth: { token: "YOUR_ACCESS_TOKEN" },
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  capabilities: ["mail", "submission"],
});

const outcome = await client.isolated((api, cancel) => {
  const first = api.Mailbox.query({ limit: 1 });
  const sibling = api.Email.query({ limit: 1 });
  const settled = Promise.allSettled([first, sibling]);
  cancel();
  return settled;
});
console.log(outcome); // Both rejected with CancellationError.

const queued = client.api.Mailbox.query({ limit: 1 });
const mainOutcome = Promise.allSettled([queued]);
client.cancelBatch();
console.log(await mainOutcome);
```

Once the flush removes jobs from the queue, cancellation has no effect on them,
even while they await session discovery or an HTTP response. It does not abort
`fetch`, undo a server write, cancel blobs, or unsubscribe from events.

Each API's cancellation callback uses a one-shot abort controller. Only its first
invocation clears the current queue; later invocations do nothing. Calls queued
after cancellation can still run. Use a new `isolated()` scope for each independently
cancellable operation (or a new client when the main queue needs a fresh cancellation
lifecycle). The API does not support cancelling a single member of a shared batch.
