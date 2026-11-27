---
"json-meta-client": minor
---

Add the `transport` client option and `webSocketTransport()`, for the JMAP
WebSocket subprotocol (RFC 8887). The default, `httpTransport()`, behaves as
0.14 did.

```ts
import {
  JsonMetaClient,
  webSocketTransport,
} from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl,
  auth: token,
  capabilities: ["mail"],
  transport: webSocketTransport(),
});
```

All of a client's batches share one socket. It opens with the first batch
and closes after `idleSeconds` (default 60) with nothing pending. A request
with no response within `requestTimeoutSeconds` (default 60) closes the
socket and rejects what was waiting with `NetworkError`. While push is
enabled, a `Core/echo` heartbeat every `heartbeatSeconds` (default 30)
detects a dead socket and reconnects. The global `WebSocket` can't send
the headers from `auth`, so pass `createWebSocket` to use a client that can,
such as the `ws` package.

To write your own transport, implement the new `Transport` interface. The
package now exports the `JmapRequest`, `JmapResponse`, `Session`, and
`StateChange` types it needs.

The client now wraps a transport error that isn't a `JsonMetaError` in a
`NetworkError`, or a `CancellationError` once the client is disposed, with
the original error as its `cause`. A response body that isn't valid JSON
rejects with `NetworkError` instead of `SyntaxError`.
