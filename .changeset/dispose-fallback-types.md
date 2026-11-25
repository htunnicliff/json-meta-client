---
"json-meta-client": minor
---

Type the `disconnect` fallback used on runtimes without `Symbol.dispose`. The
client, the `Transport` interface and the subscriptions `onStateChange()`
resolves to now declare an optional `disconnect()` method, described by the
new `DisposeFallback` type. A transport's `subscribe` may return the new
`DisposableLike`: a `Disposable`, or an object with a `disconnect` method.
