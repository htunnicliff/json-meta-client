---
"json-meta-client": minor
---

Set `generateMethodCallId` on a client to generate custom method call IDs.
The callback receives the JMAP method name and returns a string synchronously.
This also applies to isolated batches. An explicit `{ id }` on a method call
takes precedence.
