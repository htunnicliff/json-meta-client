# Best Practices

## Let batching group calls

:::warning TODO
- Avoid sequential awaits; use result references instead of extra round trips;
  `void` for discarded results
:::

## Keep batches within server limits

:::warning TODO
- Read `maxCallsInRequest` / `maxObjectsInGet` from the session and chunk large operations
:::

## Reuse one client

:::warning TODO
- The session is cached; the client is frozen and cheap to share
:::

## Handle session changes

:::warning TODO
- Compare the response's `sessionState` (via an `afterJmapResponse` hook) and
  call `refreshSession()` when it changes
- A failed session fetch stays cached; call `refreshSession()` to retry
:::

## Keep data in sync

:::warning TODO
- Use `/changes` and `/queryChanges` with cursors from `onStateChange` rather than refetching
:::

## Request only the properties you need

## Use readable creation IDs and call IDs

:::warning TODO
- They make debugging easier
:::

## Handle errors by class

:::warning TODO
- Use the type guards; handle partial failures within a batch
:::

## Supply fresh credentials

:::warning TODO
- Use the `auth` callback for rotating tokens
:::
