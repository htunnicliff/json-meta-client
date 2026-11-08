# Batching

## How batching works

:::warning TODO
- Calls made in the same synchronous turn are queued and sent as one request in a microtask
- A call made after an `await` goes in a separate request
- A call queued while an earlier request is in flight starts a new request
- Call order is preserved
:::

## Writing batch-friendly code

:::warning TODO
- Create calls together; await only results you use (`void` for discarded results)
- Anti-pattern: awaiting each call in turn
- `Promise.all` only when several results are needed
:::

## Limits

:::warning TODO
- The client does not split batches by `maxCallsInRequest` / `maxSizeRequest`;
  large batches can exceed server limits. Explain manual chunking
:::

## Failure behavior

:::warning TODO
- Transport, HTTP, JSON-parse, or hook failure rejects every call in the batch with the same error
- A method-level error rejects only that call
:::

## Matching responses

:::warning TODO
- Responses are matched by call ID, not order
- Implicit responses are handled (e.g. the `Email/set` triggered by
  `EmailSubmission/set`'s `onSuccessDestroyEmail`)
- Missing or mismatched response gives `MethodCallError`
:::

## Cancelling

:::warning TODO
- `client.cancelBatch()` rejects unsent calls with `CancellationError`;
  later batches still work; requests already sent are not aborted
:::

## Isolated queues

:::warning TODO
- `client.isolated((api, cancel) => ...)` gives a separate queue unaffected by `cancelBatch`
- The callback's return value is passed back unchanged
- Use cases: separate UI views, cancelling one group of calls without the others
:::
