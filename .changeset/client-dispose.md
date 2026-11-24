---
"json-meta-client": minor
---

Add `client[Symbol.dispose]()`, so a client can be declared with `using`.
Disposing a client rejects JMAP Requests in flight with `CancellationError`,
ends every `onStateChange` subscription, and disposes the transport. Later
method calls and subscriptions reject with `CancellationError`.
