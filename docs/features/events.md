# Events

## Subscribing

:::note TODO
- `await client.onStateChange(handler, { signal?, pingSeconds? })`; loads `eventsource-client` lazily
- Always subscribes with `types: "*"` and `closeafter: "no"`; `pingSeconds` defaults to 30
:::

## The handler

:::note TODO
- Called Node-style as `(error, change)`
- Called once per entity per account with a `StateChangePayload`:
  `accountId`, `isPrimaryAccount` (primary mail account), `entity`, `state`
- Messages other than `StateChange` are ignored
:::

## Reacting to changes

:::note TODO
- Usual follow-up: pass `state` as `sinceState` to `Entity/changes` (example)
:::

## Errors

:::note TODO
- Malformed messages and failed connections reach the handler as `StateChangeError`;
  its `cause` may be `HttpError` (bad status or content type) or `NetworkError`
- Delivery continues after a malformed message
- Intentional aborts are not reported
:::

## Reconnects

:::note TODO
- The stream reconnects automatically
- `auth` and hooks run again on every reconnect, so credentials stay current
- HTTP 204 stops reconnecting
:::

## Unsubscribing

:::note TODO
- `using sub = await client.onStateChange(...)`, `sub[Symbol.dispose]()`, or abort the `signal`
:::
