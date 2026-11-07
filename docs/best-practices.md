# Best Practices

:::note TODO
These docs haven't been written yet but will be added soon.
:::

<!-- DOCS OUTLINE (not rendered)
- ## Let batching group calls
  - Avoid sequential awaits; use result references instead of extra round trips;
    `void` for discarded results
- ## Keep batches within server limits
  - Read `maxCallsInRequest` / `maxObjectsInGet` from the session and chunk large operations
- ## Reuse one client
  - The session is cached; the client is frozen and cheap to share
- ## Handle session changes
  - Compare the response's `sessionState` (via an `afterJmapResponse` hook) and
    call `refreshSession()` when it changes
  - A failed session fetch stays cached; call `refreshSession()` to retry
- ## Keep data in sync
  - Use `/changes` and `/queryChanges` with cursors from `onStateChange` rather than refetching
- ## Request only the properties you need
- ## Use readable creation IDs and call IDs
  - They make debugging easier
- ## Handle errors by class
  - Use the type guards; handle partial failures within a batch
- ## Supply fresh credentials
  - Use the `auth` callback for rotating tokens
-->
