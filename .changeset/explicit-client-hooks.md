---
"json-meta-client": minor
---

Add `beforeFetch` / `afterFetch`, `beforeJmapRequest` / `afterJmapResponse`, and `beforeEventSourceConnect` / `afterEventSourceConnect` hooks with sequential async support. Fetch hooks cover every transport; JMAP hooks transform complete batch envelopes; connection hooks run for each event-stream connection or reconnect before messages are read.

Breaking: remove the `beforeRequest` / `afterResponse` options and the `BeforeRequestHook` / `AfterResponseHook` type exports. The Fetch hook interface is now `beforeFetch` / `afterFetch` with `BeforeFetchHook` / `AfterFetchHook` types.

Event streams now validate status, content type, and body availability before connection observers run. Connection failures are reported through the state-change handler as `StateChangeError`; intentional aborts remain silent and HTTP 204 still stops reconnects.
