# Batching

:::note TODO
These docs haven't been written yet but will be added soon.
:::

<!-- DOCS OUTLINE (not rendered)
- ## How batching works
  - Calls made in the same synchronous turn are queued and sent as one request in a microtask
  - A call made after an `await` goes in a separate request
  - A call queued while an earlier request is in flight starts a new request
  - Call order is preserved
- ## Writing batch-friendly code
  - Create calls together; await only results you use (`void` for discarded results)
  - Anti-pattern: awaiting each call in turn
  - `Promise.all` only when several results are needed
- ## Limits
  - The client does not split batches by `maxCallsInRequest` / `maxSizeRequest`;
    large batches can exceed server limits. Explain manual chunking
- ## Failure behavior
  - Transport, HTTP, JSON-parse, or hook failure rejects every call in the batch with the same error
  - A method-level error rejects only that call
- ## Matching responses
  - Responses are matched by call ID, not order
  - Implicit responses are handled (e.g. the `Email/set` triggered by
    `EmailSubmission/set`'s `onSuccessDestroyEmail`)
  - Missing or mismatched response gives `MethodCallError`
- ## Cancelling
  - `client.cancelBatch()` rejects unsent calls with `CancellationError`;
    later batches still work; requests already sent are not aborted
- ## Isolated queues
  - `client.isolated((api, cancel) => ...)` gives a separate queue unaffected by `cancelBatch`
  - The callback's return value is passed back unchanged
  - Use cases: separate UI views, cancelling one group of calls without the others
-->
