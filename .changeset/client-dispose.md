---
"json-meta-client": minor
---

Add `client[Symbol.dispose]()`, so a client can be declared with `using`.
Disposing a client rejects JMAP Requests, blob transfers and session requests
in flight with `CancellationError`, ends every `onStateChange` subscription,
and disposes the transport. Later method calls, blob transfers, session
refreshes and subscriptions reject with `CancellationError`. On a runtime
without `Symbol.dispose`, the method is named `disconnect`.
