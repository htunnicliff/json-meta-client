---
"json-meta-client": patch
---

Fix `cancelBatch()`, and the `cancel` that `isolated()` passes to its callback,
only working the first time. Every call now rejects the method calls waiting in
the current batch with a `CancellationError`.
