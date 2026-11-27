---
"json-meta-client": minor
---

`onStateChange` handlers now share one push channel, and the client reads
the event stream itself instead of using `eventsource-client`.

- With `webSocketTransport()` and a server that supports push, state changes
  arrive over the WebSocket, and the transport resumes from the last
  `pushState` after reconnecting.
- Otherwise, the client opens one event stream for each distinct
  `pingSeconds` value, instead of one for each handler.
- The event stream reconnects when it ends or the network fails, sending
  `Last-Event-ID` and honoring the server's `retry` time. After repeated
  failures, it backs off with jitter, up to a minute.
- If nothing arrives, not even a ping, for two ping intervals, the client
  reconnects and reports a `StateChangeError` to the handler.
- If the server refuses the connection with an HTTP error, or responds with
  something other than an event stream, the client reports a
  `StateChangeError` and stops reconnecting. HTTP 204 also stops it, without
  an error.
- A handler receives nothing before its `onStateChange` call resolves, and a
  `signal` that aborts while the subscription starts ends it.
