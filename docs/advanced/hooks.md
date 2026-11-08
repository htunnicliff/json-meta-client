# Hooks

## Lifecycle overview

:::note TODO
- Diagram or ordered list: `auth` → `beforeFetch` → `beforeEventSourceConnect`
  (streams only) → `fetch` → `afterFetch` → stream validation →
  `afterEventSourceConnect` → status check and JSON parse
- For API calls: middleware → `beforeJmapRequest` → HTTP hooks →
  `afterJmapResponse` → resolve each call
:::

## Common rules

:::note TODO
- Each hook option is an array; hooks run in order, may be async, are awaited,
  and must return the replacement value (except `afterEventSourceConnect`)
:::

## `beforeFetch` / `afterFetch`

:::note TODO
- Run on every HTTP request: session, API, upload, download, stream
- `afterFetch` receives a clone of the request and can rewrite or repair a
  response before status validation (example: replacing a 503)
:::

## `beforeJmapRequest` / `afterJmapResponse`

:::note TODO
- Run once per batch on the whole envelope (`using`, `methodCalls`, `createdIds`)
- Example: logging, adding `createdIds`
:::

## `beforeEventSourceConnect` / `afterEventSourceConnect`

:::note TODO
- Run for each stream connection or reconnect
- The after hook only observes headers and must not read the body
:::

## Errors in hooks

:::note TODO
- Errors thrown before the fetch are wrapped in `NetworkError` unless already a library error
- Errors thrown after the fetch pass through unchanged
- A failing JMAP hook rejects the whole batch
:::

## Recipes

:::note TODO
- Logging, request IDs or tracing headers, snapshotting the request body
  (as in the find-inbox test), token refresh (point to the `auth` callback instead)
:::

## Middleware (unstable)

:::note TODO
- Synchronous functions transforming each method's argument object,
  `(payload: JsonValue) => JsonValue`
- Run after the built-in ref-key rewrite and account-ID injection; must return an object
- Note: the `Middleware` type is not exported publicly yet
:::
