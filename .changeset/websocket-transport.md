---
"json-meta-client": minor
---

Add `webSocketTransport()` for the JMAP WebSocket subprotocol (RFC 8887). Every
batch of a client shares one socket, which opens on the first batch and closes
after `idleSeconds` (default 60) with nothing pending. Responses settle by
`requestId`, a `RequestError` rejects only its own request with `JmapError`,
and a closed socket rejects requests in flight with `NetworkError`. Pass
`createWebSocket` to send the headers from `auth`, for example with the `ws`
package; the default global `WebSocket` sends none. Batches reject with
`ConfigurationError` when the session doesn't advertise
`urn:ietf:params:jmap:websocket`.

A request with no response within `requestTimeoutSeconds` (default 60), or a
message that can't be parsed, closes the socket and rejects what was waiting
on it with `NetworkError`. While push is enabled, a `Core/echo` heartbeat
every `heartbeatSeconds` (default 30) detects a dead socket and reconnects.
Push reconnects back off from one second to 30 seconds, and the backoff
resets only once a new socket receives a message.
