---
"json-meta-client": minor
---

Add the `transport` client option and the public `Transport` interface.
`transport` takes a `TransportFactory`, which the client calls once with a
`TransportContext` (`authenticate` and `fetch`). It defaults to the new
`httpTransport()`, so existing clients behave as before. The package now also
exports the `JmapRequest`, `JmapResponse`, `Session` and `StateChange` types a
custom transport needs.

The Dispatcher now wraps a transport error that isn't a `JsonMetaError` in a
`CancellationError` once the client is disposed, or a `NetworkError`
otherwise, with the original as its `cause`. A transport that resolves with
something other than a JMAP Response rejects the batch with `UnknownError`.
A JMAP Response body that isn't valid JSON now rejects with a `NetworkError`
that carries the request, instead of a bare `SyntaxError`.
