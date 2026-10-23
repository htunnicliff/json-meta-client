# Events

A JMAP event stream lets your application learn that server data has changed without repeatedly polling. Notifications carry account IDs, entity names, and state tokens; retrieve the actual records with API methods.

Your provider must advertise a usable `eventSourceUrl` in its session.

## Open a subscription

```ts
const controller = new AbortController();

await client.onStateChange(
  (error, change) => {
    if (error) {
      console.error("Notification processing failed:", error);
      return;
    }

    console.log(change.accountId, change.entity, change.state);
  },
  { signal: controller.signal },
);

// Run when this subscription is no longer needed.
controller.abort();
```

Awaiting `onStateChange()` lets you handle failures loading the session or setting up the subscription. Its resolution means setup has completed; it does not guarantee that the stream has connected.

## Read a notification

The callback receives `(null, change)` once for each account/entity pair in a state-change message.

| Property           | Description                                                              |
| ------------------ | ------------------------------------------------------------------------ |
| `accountId`        | Account whose data changed                                               |
| `entity`           | Data type, for example `Email` or `Mailbox`                              |
| `state`            | Current data-type state token                                            |
| `isPrimaryAccount` | Whether this is the primary mail account from the subscription's session |

A single server message may therefore invoke your callback several times.

## Bring local data up to date

Keep the data state from your last `get` or `changes` response. When a notification arrives:

1. Call the entity's `changes` method with that saved state as `sinceState`.
2. Fetch created and updated records, and remove destroyed IDs from your local data.
3. Save the response's `newState` after applying those changes.
4. If `hasMoreChanges` is true, continue from `newState` until all changes are processed.

Serialize this work for each account and entity so overlapping notifications do not race to update the same saved state. If the server can no longer calculate changes, rebuild from a fresh snapshot.

A query's `queryState` is a different token used by `queryChanges`. Do not substitute a notification's data state for a query state. For a simple message list, rerunning the query is also an option.

## Control the subscription's lifetime

Pass a fresh, un-aborted `AbortSignal` and abort it during cleanup. The implementation listens for an abort event; a signal that was already aborted will not close a newly created stream.

The returned subscription provides `[Symbol.dispose]()` when the runtime has that symbol, or `disconnect()` otherwise. Using an abort controller avoids depending on that runtime-specific object shape.

`pingSeconds` asks the server for a ping interval and defaults to `30`. Pings are not delivered as data-change notifications.

## Handle callback errors

Failures parsing or processing an incoming message are reported as `(StateChangeError, undefined)`. Synchronous exceptions from your callback enter this same error path.

Keep the callback synchronous. If it starts asynchronous work, handle that work's rejected promise yourself; the subscription does not await it.

The callback is not a general listener for transport errors on the underlying event stream. Subscription setup failures reject `onStateChange()` instead. Streams use a separate authenticated connection and do not run the client's [HTTP hooks](./hooks.md).
