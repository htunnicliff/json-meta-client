# Batching

Calls created together on one client can share a single JMAP request. This reduces HTTP round trips while keeping a separate promise for every method.

## Create the calls before awaiting

```ts
const mailboxes = client.api.Mailbox.get({});
const recentIds = client.api.Email.query({ limit: 10 });

const [mailboxResult, queryResult] = await Promise.all([mailboxes, recentIds]);
```

Both calls enter the queue immediately. The client uses `queueMicrotask()` to schedule its flush, so calls created synchronously together enter the same batch.

An `await` between calls gives the queued flush a chance to run. In particular, awaiting one method's result before creating the next sends separate requests. Create all members of a batch before yielding control.

## Combine dependent methods

When the second method needs a value from the first, let the server resolve a reference:

```ts
const query = client.api.Email.query({ limit: 10 });
const get = client.api.Email.get({ ids: query.ref("/ids") });

const [, messages] = await Promise.all([query, get]);
```

The query precedes the get call in the request. The server substitutes the query's IDs into the get arguments. See [Result references](./result-references.md) for the available pointer forms.

## Handle every outcome

Each promise settles according to its own method response. One method error can leave other calls successful, although a dependent method may also fail if its source result is unavailable.

A session or transport failure affects every call in the request. `Promise.all()` rejects as soon as an input rejects; use `Promise.allSettled()` when you need to examine success and failure for each method separately.

## Respect server limits

The client does not divide a large batch into smaller requests to fit the server's advertised limits. Read the session's limits and control how many calls you create together. If you split work across requests, references must stay within each individual request.

## Cancel queued work

Call `cancelBatch()` before the scheduled flush to reject the queued promises with `CancellationError`:

```ts
const pending = client.api.Mailbox.get({});
client.cancelBatch();

try {
  await pending;
} catch (error) {
  console.log("The queued call was cancelled");
}
```

Cancellation does not abort a request that has already started. New calls can still run afterward.

::: warning Current cancellation limit
The client uses one abort controller for its lifetime. Only the first `cancelBatch()` call emits an abort event; subsequent calls do not cancel later batches. Treat cancellation as a one-time operation on that client.
:::
