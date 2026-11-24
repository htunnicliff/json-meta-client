# Transports are factories the client calls once

The client sends JMAP Requests through a public `Transport` that it creates by
calling the `transport` option, a `TransportFactory`, once in its constructor
with a `TransportContext` (`authenticate` and `fetch`). Built-in transports are
exported as factories (`httpTransport()`, `webSocketTransport()`) rather than
selected by strings, and the client never falls back from one to another.

## Considered Options

- **The internal function, `(request, session) => Promise<JmapResponse>`.**
  Rejected: it can't reach `auth`, deliver push messages, or be disposed, and
  adding any of those later would break custom transports.
- **A transport object passed in config, `{ send, subscribe?, dispose? }`.**
  Rejected: the client has no way to hand it `auth` except on every call, and
  one instance passed to two clients would share a socket between different
  credentials.
- **A factory the client calls once, with its context.** Chosen. Each client
  gets its own transport, and the context gives it what it needs without
  exposing the client's HTTP internals.

## Consequences

- Factories instead of strings keep the WebSocket code out of bundles that
  only use HTTP, since the package sets `sideEffects: false`, and let a
  transport take options such as `createWebSocket`.
- `beforeJmapRequest` and `afterJmapResponse` stay in the Dispatcher, outside
  the transport, so every transport gets them. The fetch hooks run only where a
  transport uses `context.fetch`.
- The Dispatcher wraps transport errors that aren't a `JsonMetaError` in a
  `NetworkError`, so callers can always catch `JsonMetaError`.
- A transport's optional `subscribe` provides its push channel. The client
  calls it at most once for all `onStateChange` handlers and fans changes out
  itself; a missing or `null` channel means the event stream.
- Using the WebSocket transport against a session that doesn't advertise
  `urn:ietf:params:jmap:websocket` rejects batches with `ConfigurationError`
  instead of silently using HTTP.
