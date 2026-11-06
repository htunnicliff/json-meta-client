---
"json-meta-client": minor
---

Add `beforeFetch` / `afterFetch`, `beforeJmapRequest` / `afterJmapResponse`, and `beforeEventSourceConnect` / `afterEventSourceConnect` hooks with sequential async support. Fetch hooks cover every transport; JMAP hooks transform complete batch envelopes; connection hooks run for each event-stream connection or reconnect before messages are read.

Retain `beforeRequest` / `afterResponse` and their types as deprecated compatibility names. When both names are configured, legacy hooks run before the new Fetch hooks.

Event streams now validate status, content type, and body availability before connection observers run. Connection failures are reported through the state-change handler as `StateChangeError`; intentional aborts remain silent and HTTP 204 still stops reconnects.
