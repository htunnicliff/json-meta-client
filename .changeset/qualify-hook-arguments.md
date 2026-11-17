---
"json-meta-client": major
---

Breaking change to hook callback arguments. JMAP hooks receive `jmapRequest`
and, in `afterJmapResponse`, `jmapResponse`. Fetch and event-source hooks
receive `httpRequest` and, in after hooks, `httpResponse`.
