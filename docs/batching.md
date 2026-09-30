# Automatic batching

Every API call queues a method immediately and returns a promise. The client
collects calls until the next microtask flush, then sends them in call order.
Server limits may split a batch across several requests.

## Calls that share a batch

Issue calls synchronously to put them in the same batch. Awaiting their promises
later does not change that grouping:

```ts
const a = client.api.Email.query({ limit: 10 });
const b = client.api.Mailbox.query({ limit: 10 });
await a;
await b;
```

These independent calls share a request if they fit the server's limits. Calls
are queued when invoked, so sending them does not depend on awaiting them.

Await a result before issuing another call when the next call needs its data:

```ts
const a = await client.api.Email.query({ limit: 10 });
const b = await client.api.Email.get({ ids: a.ids });
```

This produces two requests. To express a dependency within one request instead,
use a [result reference](results-and-references.md): queue the source first, then
pass `ref(source, "/ids")` to the dependent call before the same flush.

## Where a batch ends

A batch's membership is fixed when its flush starts. Even if the client is still
loading the session or waiting for a response, later calls form another batch.

Microtasks run in queue order. A microtask queued before the flush can add calls
to its batch; one queued after the flush starts a new batch. For example,
`await Promise.resolve()` after an API call lets the scheduled flush start before
the code following the `await` runs.

Separate batches can overlap and finish out of order. Await the earlier call
when execution order matters. Within a batch, requests created to meet server
limits run sequentially. See [server request limits](request-limits.md) for
splitting rules and concurrency limits. There is no manual flush operation.

## How calls settle

Each response is matched to its call by ID, so response order does not affect
which promise receives a result.

- A method error rejects that call. Other calls settle from their own responses,
  including calls that depend on the failed method.
- An HTTP or transport failure rejects every call in that request with the same
  error. Other requests created from the batch still run.
- A missing method response rejects the call that expected it.
- A failure during batch processing rejects all promises still pending in the
  batch. Promises already settled keep their results.

Both synchronous exceptions and asynchronous failures are handled, and later
batches can still run. See [errors](errors.md) for error classes and
[cancellation](cancellation.md) for aborting individual calls in a shared request.
