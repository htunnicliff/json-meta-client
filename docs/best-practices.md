# Best Practices

## Let batching group calls

:::note TODO
- Avoid sequential awaits; use result references instead of extra round trips;
  `void` for discarded results
:::

## Keep batches within server limits

:::note TODO
- Read `maxCallsInRequest` / `maxObjectsInGet` from the session and chunk large operations
:::

## Reuse one client

:::note TODO
- The session is cached; the client is frozen and cheap to share
:::

## Handle session changes

:::note TODO
- Compare the response's `sessionState` (via an `afterJmapResponse` hook) and
  call `refreshSession()` when it changes
- A failed session fetch stays cached; call `refreshSession()` to retry
:::

## Keep data in sync

:::note TODO
- Use `/changes` and `/queryChanges` with cursors from `onStateChange` rather than refetching
:::

## Request only the properties you need

## Use readable creation IDs and call IDs

:::note TODO
- They make debugging easier
:::

## Handle errors by class

:::note TODO
- Use the type guards; handle partial failures within a batch
:::

## Supply fresh credentials

:::note TODO
- Use the `auth` callback for rotating tokens
:::
