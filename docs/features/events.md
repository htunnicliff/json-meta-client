# Events

## Subscribing

:::warning TODO
- `await client.onStateChange(handler, { signal?, pingSeconds? })`
- Always subscribes to every data type
:::

## Push channels

State changes arrive on one of two push channels:

- **WebSocket push**, when the client uses `webSocketTransport()` and the
  session's WebSocket capability sets `supportsPush`. It shares the socket
  that carries method calls. See [Transports](../advanced/transports.md#push).
- **The event stream** otherwise. The client opens the session's
  `eventSourceUrl` with `closeafter: "no"`, loading `eventsource-client`
  lazily.

Handlers share a channel: the client opens one WebSocket push subscription
for all of them, or one event stream for each distinct `pingSeconds` value.
The channel closes when the last handler leaves.

`pingSeconds` applies only to the event stream and defaults to 30.

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
- WebSocket push reports a dropped socket as `StateChangeError`, reconnects
  with backoff, and resumes from the last `pushState`
:::

## Unsubscribing

:::warning TODO
- `using sub = await client.onStateChange(...)`, `sub[Symbol.dispose]()`, or abort the `signal`
- `client[Symbol.dispose]()` ends every subscription
:::
