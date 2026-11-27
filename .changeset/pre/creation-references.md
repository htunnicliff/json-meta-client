---
"json-meta-client": major
---

**Breaking:** creation references now follow RFC 8620 §5.3, and their
errors are the new `CreationReferenceError` instead of `RangeError`.

- `createdRef()` throws a `CreationReferenceError` with reason
  `"unknown-id"` for an ID that isn't a key of `create`. It used to throw a
  `RangeError`.
- `createdRef()` throws with reason `"batch-sent"` once its `/set` call's
  batch was sent, for example after `await`ing the call. The server would no
  longer resolve the reference.
- A `/set` or `/copy` call, or `Email/import`, that reuses a creation ID from
  an earlier call in the same batch rejects with reason `"duplicate-id"`
  without being sent. The server would map every later reference to the most
  recent object with that ID. The rest of the batch is still sent.
