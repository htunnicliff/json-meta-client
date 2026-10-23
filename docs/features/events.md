# Events

JMAP state-change events tell you when data has changed. They do not contain the updated records. The server must provide a usable `eventSourceUrl` in its session.

## Subscribing

```ts
const controller = new AbortController();

await client.onStateChange(
  (error, change) => {
    if (error) {
      console.error(error);
      return;
    }

    console.log(change.accountId, change.entity, change.state);
  },
  { signal: controller.signal },
);

// When the subscription is no longer needed:
controller.abort();
```

`onStateChange()` returns a promise for a disposable subscription. Await it so session-loading and subscription-setup failures can be handled. Resolution does not guarantee that the event stream has connected.

## Change Payload

The handler receives `(null, change)` for each account/entity pair in a state-change message:

| Field              | Meaning                                            |
| ------------------ | -------------------------------------------------- |
| `accountId`        | Account whose data changed                         |
| `entity`           | Changed data type, such as `Email`                 |
| `state`            | New state token for that data type                 |
| `isPrimaryAccount` | Whether this is the session’s primary mail account |

## Fetching Updates

Keep the previous state from a `get` or `changes` response. When a notification arrives, call the entity’s `changes` method with that previous value as `sinceState`, then fetch the created and updated records. Store the returned `newState` after processing the changes.

A query’s `queryState` is a separate token used by `queryChanges`. Do not pass a notification’s data-type state as a query state. If the server cannot calculate changes, fetch a fresh snapshot.

## Options and Cleanup

`pingSeconds` requests a server ping interval and defaults to `30`. `signal` closes the connection when it emits an abort event; pass a fresh, un-aborted signal when subscribing.

The returned object also exposes `[Symbol.dispose]()` on runtimes supporting that symbol, with `disconnect()` as a fallback otherwise. An `AbortController` provides a cleanup option that works with either shape.

The stream uses a separate authenticated connection and bypasses [HTTP hooks](./hooks.md).

## Errors

Failures while processing an incoming message are delivered as `(StateChangeError, undefined)`. This includes synchronous exceptions thrown by your handler. Keep the handler synchronous and handle rejections from any asynchronous work you start inside it.

Setup failures reject `onStateChange()`. The callback is not a general transport-error listener for the underlying event stream. See [Errors](../reference/errors.md).
