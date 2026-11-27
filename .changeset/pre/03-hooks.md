---
"json-meta-client": major
---

**Breaking:** new hooks replace `beforeRequest`, `afterResponse`, and the
unstable `middleware` option.

| 0.14                       | 1.0                       |
| -------------------------- | ------------------------- |
| `hooks.beforeRequest`      | `hooks.beforeFetch`       |
| `hooks.afterResponse`      | `hooks.afterFetch`        |
| `middleware`               | `hooks.beforeJmapRequest` |
| `BeforeRequestHook` (type) | `BeforeFetchHook`         |
| `AfterResponseHook` (type) | `AfterFetchHook`          |

Fetch hooks receive `httpRequest` and, after the fetch, `httpResponse`,
instead of `request` and `response`:

```ts
hooks: {
  beforeFetch: [({ httpRequest }) => httpRequest],
  afterFetch: [({ httpResponse }) => httpResponse],
},
```

The new hooks are:

- `beforeJmapRequest` and `afterJmapResponse`, which receive the whole JMAP
  Request (`jmapRequest`) and Response (`jmapResponse`) of each batch. Use
  `beforeJmapRequest` in place of `middleware` to change outgoing method
  calls.
- `beforeEventSourceConnect` and `afterEventSourceConnect`, which run for
  each event stream connection and reconnect.

Each option takes an array of hooks, which may be async and run in order.
Passing `middleware` is now a type error, and the client ignores it.
