# Respond to account changes

A state-change subscription tells your application when account data changes.
Use it to invalidate a view or start synchronisation. Notifications contain
state tokens, not the changed records, so your application still needs to fetch
the data it displays.

The server's session must provide an accessible `eventSourceUrl`. The client
uses your configured authentication for every connection and reconnect.

## Subscribe and release the connection

Give each subscription an owner, such as a page or worker, and close it when
that owner finishes. This helper listens for Email changes in the primary mail
account. It accepts a fresh abort signal and returns an explicit cleanup function:

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail"],
});

export async function watchEmailChanges(
  signal: AbortSignal,
  invalidate: (accountId: string) => void,
) {
  const subscription = await client.onStateChange(
    (error, change) => {
      if (error) {
        console.error(
          "State subscription failed",
          error.cause,
        );
        return;
      }
      if (
        change.entity === "Email" &&
        change.isPrimaryAccount
      ) {
        invalidate(change.accountId);
      }
    },
    { signal, pingSeconds: 30 },
  );

  return () => subscription[Symbol.dispose]();
}
```

Call the returned function during teardown, or abort the signal after
registration to close the stream and stop reconnects. The example uses
`Symbol.dispose`, which is available in Node.js 26; browser runtimes need that
symbol or a resource-management polyfill. It does not require `using` syntax.

Pass a signal that has not already been aborted. The current implementation
listens for a later abort event and does not check the signal at registration.
If setup fails, `onStateChange()` rejects, so handle the helper's returned
promise at your application's error boundary as well.

The setup promise resolves when the subscription object exists. It does not
wait for an established connection or the first notification. Use a
[connection hook](../advanced/hooks.md#event-stream-connections) if you need to
observe a validated connection.

## Filter notifications in your handler

The client requests all data types and delivers each account/entity pair in a
`StateChange` message separately. It does not filter by configured capability
or account. Other messages, including pings, are ignored.

| Field              | Meaning                                                 |
| ------------------ | ------------------------------------------------------- |
| `accountId`        | The account whose data changed.                         |
| `entity`           | The changed data type, such as `Email` or `Mailbox`.    |
| `state`            | An opaque state token for that account and data type.   |
| `isPrimaryAccount` | Whether this is the session's primary **mail** account. |

The callback receives `(null, change)` for a notification and
`(StateChangeError, undefined)` for a connection or message-processing failure.
Parsing errors and errors thrown synchronously by the success handler use that
same error path. An exception in the error handler is not caught again.

Keep the handler synchronous. If it starts asynchronous refresh work, give
that work its own rejection handler: the client does not await handler promises.
Coordinate refreshes so an older request cannot overwrite newer cached data.

## Reconcile data after a notification

Keep the state returned by your last successful `get` or `changes` response.
When a notification arrives, pass that saved state as `sinceState` to the
entity's `changes` method. Fetch created and updated IDs, remove destroyed IDs,
and save the new state after applying the changes. If `hasMoreChanges` is true,
continue from the returned state until you have caught up.

The notification's token describes the server's new data state. Replacing your
saved state with it before fetching changes would skip the difference you need
to apply. It is also a data-type state, not a query-state token for
`queryChanges`. If the server returns `cannotCalculateChanges`, fetch a fresh
snapshot instead.

## Plan for reconnection

The bundled event-source transport reconnects after stream completion or fetch
failure. Its initial delay is two seconds; an SSE `retry` field can change it.
Received SSE IDs become `Last-Event-ID` on reconnect. Authentication and
[Fetch and connection hooks](../advanced/hooks.md) run on every attempt.

A failed connection reaches your handler as `StateChangeError`, with the
underlying failure in `cause`, while the transport retains its retry behaviour.
An intentional abort does not report a connection failure. HTTP 204 closes the
stream and stops reconnecting; invalid stream responses fail before messages
are read.

The client requests a persistent stream with `types=*` and `closeafter=no`.
`pingSeconds`, which defaults to `30`, asks the server for a ping interval and
is rounded to an integer in the URL. It is not a client-side timeout.

Reconnection is not a guarantee that every change notification will be replayed.
The client does not persist cursors, deduplicate notifications, or refresh data
automatically. Reconcile your saved state after startup and interruptions, even
if no new notification arrives. The [error reference](../reference/errors.md)
describes setup rejection and callback error delivery separately.
