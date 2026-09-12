# Reconnect only while the connection is needed

After an unexpected disconnect, the client will reconnect with backoff while WebSocket push remains enabled, and a new WebSocket API request will trigger an immediate connection attempt. It will not maintain an idle connection when neither push nor requests require one. Calling `close()` is terminal for that client and cancels reconnection, making resource ownership deterministic.
