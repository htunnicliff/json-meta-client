---
"json-meta-client": minor
---

Add definitive error kinds, including separate HTTP and protocol errors with
request and response context. Retain the associated method call on JMAP errors
and validate server response envelopes before processing them.

Preserve upload body media types instead of forcing JSON request headers.
