---
"json-meta-client": minor
---

The client now reads the JMAP event stream itself and no longer depends on
`eventsource-client`, so the package has no runtime dependencies.

- The event stream reconnects when it ends or the network fails, sending
  `Last-Event-ID` and honoring the server's `retry` time. After failures in a
  row it backs off, with jitter, up to a minute.
- New: if nothing arrives, not even a ping, for two ping intervals, the
  client treats the connection as dead and reconnects. It reports this to the
  handler as a `StateChangeError`.
- A connection the server refuses, with an HTTP error or a response that
  isn't an event stream, is reported as a `StateChangeError`, and the client
  stops reconnecting. HTTP 204 also stops it, without an error.
