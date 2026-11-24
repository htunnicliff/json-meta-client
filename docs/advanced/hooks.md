# Hooks

## Lifecycle overview

:::warning TODO
- Diagram or ordered list: `auth` → `beforeFetch` → `beforeEventSourceConnect`
  (streams only) → `fetch` → `afterFetch` → stream validation →
  `afterEventSourceConnect` → status check and JSON parse
- For API calls: `beforeJmapRequest` → transport (HTTP hooks with
  `httpTransport()`) → `afterJmapResponse` → resolve each call
:::

## Hooks by transport

`beforeJmapRequest` and `afterJmapResponse` run for every batch, whatever
the [transport](./transports.md). The HTTP hooks run only for HTTP requests:

| Hook                         | `httpTransport()`                     | `webSocketTransport()`                             |
| ---------------------------- | ------------------------------------- | -------------------------------------------------- |
| `beforeJmapRequest`          | Every batch                           | Every batch                                        |
| `afterJmapResponse`          | Every batch                           | Every batch                                        |
| `beforeFetch` / `afterFetch` | Session, batches, blobs, event stream | Session, blobs, event stream (not the socket)      |
| Event-source hooks           | Event stream                          | Event stream, when the server doesn't support push |

## Common rules

:::warning TODO
- Each hook option is an array; hooks run in order, may be async, are awaited,
  and must return the replacement value (except `afterEventSourceConnect`)
:::

## `beforeFetch` / `afterFetch`

:::warning TODO
- Run on every HTTP request: session, API, upload, download, stream. They
  don't see WebSocket traffic
- `afterFetch` receives a clone of the request and can rewrite or repair a
  response before status validation (example: replacing a 503)
:::

## `beforeJmapRequest` / `afterJmapResponse`

:::warning TODO
- Run once per batch on the whole envelope (`using`, `methodCalls`, `createdIds`)
- Example: logging, adding `createdIds`
:::

## `beforeEventSourceConnect` / `afterEventSourceConnect`

:::warning TODO
- Run for each stream connection or reconnect
- The after hook only observes headers and must not read the body
:::

## Errors in hooks

:::warning TODO
- Errors thrown before the fetch are wrapped in `NetworkError` unless already a library error
- Errors thrown after the fetch pass through unchanged
- A failing JMAP hook rejects the whole batch
:::

## Recipes

:::warning TODO
- Logging, request IDs or tracing headers, snapshotting the request body
  (as in the find-inbox test), token refresh (point to the `auth` callback instead)
:::
