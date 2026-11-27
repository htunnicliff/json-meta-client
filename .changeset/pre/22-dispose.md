---
"json-meta-client": minor
---

Add `client[Symbol.dispose]()`, so a client can be declared with `using`:

```ts
using client = new JsonMetaClient({
  sessionUrl,
  auth,
  capabilities,
});
```

Disposing a client rejects requests in flight with `CancellationError`,
ends every `onStateChange` subscription, and disposes the transport. Later
calls reject with `CancellationError`. On a runtime without
`Symbol.dispose`, the method is named `disconnect`, as the new
`DisposeFallback` type describes.
