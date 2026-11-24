---
"json-meta-client": minor
---

`onStateChange` handlers now share one push channel instead of each opening
its own event stream. With `webSocketTransport()` and a session that supports
push, state changes arrive over the WebSocket, and the transport resumes from
the last `pushState` after reconnecting. Otherwise the client opens one event
stream for each distinct `pingSeconds` value, which now applies only to the
event stream. The handler signature and payloads are unchanged.
