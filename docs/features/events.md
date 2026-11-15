# Events

## Subscribing

:::warning TODO
- `await client.onStateChange(handler, { signal?, pingSeconds? })`; loads `eventsource-client` lazily
- Always subscribes with `types: "*"` and `closeafter: "no"`; `pingSeconds` defaults to 30
:::

## The handler

:::warning TODO
- Called Node-style as `(error, change)`
- Called once per entity per account with a `StateChangePayload`:
  `accountId`, `isPrimaryAccount`, `entity`, `state`
- `isPrimaryAccount` is per entity: true when an `Entity/get` call without
  `accountId` would go to that account (link to Account IDs). With mail primary
  A and contacts primary B, `Email` in A and `ContactCard` in B are true;
  `Email` in B and `ContactCard` in A are false
- Push-only types such as `EmailDelivery` have no `/get` to resolve, so they
  are true when the account is primary for any configured capability, or is
  the session's only account
- False when the default would be ambiguous (several accounts qualify and the
  session names no primary)
- Messages other than `StateChange` are ignored
:::

## Reacting to changes

:::warning TODO
- Usual follow-up: pass `state` as `sinceState` to `Entity/changes` (example)
:::

## Errors

:::warning TODO
- Malformed messages and failed connections reach the handler as `StateChangeError`;
  its `cause` may be `HttpError` (bad status or content type) or `NetworkError`
- Delivery continues after a malformed message
- Intentional aborts are not reported
:::

## Reconnects

:::warning TODO
- The stream reconnects automatically
- `auth` and hooks run again on every reconnect, so credentials stay current
- HTTP 204 stops reconnecting
:::

## Unsubscribing

:::warning TODO
- `using sub = await client.onStateChange(...)`, `sub[Symbol.dispose]()`, or abort the `signal`
:::
