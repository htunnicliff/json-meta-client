# Inject WebSocket connection creation

The client will own RFC 8887 protocol behavior while accepting an injectable factory that establishes the authenticated `jmap` WebSocket connection. The factory receives the advertised URL, required subprotocol, and configured bearer token, but may use the authentication mechanism appropriate to its runtime and server. This preserves Node.js and browser support without imposing a WebSocket dependency or assuming that every runtime can attach a bearer token to the opening handshake.
