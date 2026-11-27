---
"json-meta-client": major
---

**Breaking:** creation references now follow RFC 8620 §5.3, and their
errors are the new `CreationReferenceError` instead of `RangeError`. Its
`reason` says what went wrong:

- `"unknown-id"`: `createdRef()` was given an ID that isn't a key of
  `create`.
- `"batch-sent"`: `createdRef()` was called after its `/set` call's batch
  was sent, for example after `await`ing the call. The server would no
  longer resolve the reference.
- `"duplicate-id"`: a `/set` or `/copy` call, or `Email/import`, reuses a
  creation ID from an earlier call in the same batch. The call rejects
  without being sent, and the rest of the batch is still sent.
