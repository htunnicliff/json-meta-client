# Batching

JSON Meta Client automatically groups queued method calls into one JMAP request. Calls queue immediately, and the client schedules a flush with `queueMicrotask()`.

## Concurrent Calls

Create calls together before awaiting their results:

```ts
const mailboxes = client.api.Mailbox.get({});
const emails = client.api.Email.query({ limit: 10 });

const [mailboxResult, emailResult] = await Promise.all([mailboxes, emails]);
```

Both calls enter the same batch. Awaiting the first call before creating the second sends separate requests. Create all calls for a batch synchronously; an intervening `await` can allow the batch to flush.

The client does not split a batch to fit server limits. Keep the session’s advertised limits in mind when creating many calls.

## Dependent Calls

Use a [result reference](./result-references.md) when a call needs data from an earlier call in the batch:

```ts
const query = client.api.Email.query({ limit: 10 });
const get = client.api.Email.get({ ids: query.ref("/ids") });
const [queryResult, emails] = await Promise.all([query, get]);
```

The server evaluates the reference, so no client-side round trip is needed between query and get. `Promise.all()` also observes rejections from both calls.

## Failures

Each method call has its own promise. A method error rejects that call; it does not automatically reject unrelated calls in the batch. An HTTP, network, or session-loading failure rejects all calls affected by the request.

`Promise.all()` rejects when any input rejects. Use `Promise.allSettled()` if you need to inspect every outcome.

## Cancelling a Batch

Call `cancelBatch()` synchronously before the queued batch flushes:

```ts
const pending = client.api.Mailbox.get({});
client.cancelBatch();

try {
  await pending;
} catch (error) {
  // The queued call rejects with CancellationError.
}
```

Cancellation clears queued calls. It does not abort an in-flight fetch. Later calls can still run, but the current implementation uses a single abort controller: only the first `cancelBatch()` triggers cancellation. Do not rely on repeated calls to cancel later batches.
