# Events

Use state notifications to invalidate cached application data.
The server session must provide an accessible `eventSourceUrl`
for a JMAP event stream. The client authenticates each stream
connection using the same configuration as other requests.
See [shared setup](../index.md) and
[Authentication](./authentication.md).

## Subscribe and release the connection

This example listens for one minute, handles connection and malformed-message
errors, and closes the connection even if application work
fails. It uses `Symbol.dispose`, supported by Node.js 26; browser
applications need that symbol or a resource-management polyfill.
No `using` syntax is required.

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail"],
});
const controller = new AbortController();
const subscription = await client.onStateChange(
  (error, change) => {
    if (error) {
      console.error(
        "State subscription failure",
        error,
        error.cause,
      );
      return;
    }
    if (
      change.entity !== "Email" ||
      !change.isPrimaryAccount
    )
      return;
    // Invalidate the cached Email list for this account.
    console.log(
      "Refresh email",
      change.accountId,
      change.state,
    );
  },
  { signal: controller.signal, pingSeconds: 30 },
);
try {
  await new Promise<void>((resolve) =>
    setTimeout(resolve, 60_000),
  );
} finally {
  controller.abort();
  subscription[Symbol.dispose]();
}
```

The returned promise means the subscription object was created;
it does not wait for a connected stream or first message. Handle
session/setup rejection with the surrounding application's
normal promise error boundary. Always pass a fresh, un-aborted
signal: an already-aborted signal is not checked at registration.
Calling the disposable explicitly closes the stream; aborting the
signal after registration also closes it and stops reconnects.

`pingSeconds` defaults to `30`; it requests the server's ping
interval and is rounded with `toFixed(0)` in the URL. It is not a
client-side timeout or heartbeat monitor.

## Interpret notifications

The callback receives `(null, change)` for each account/entity
pair in a `StateChange` message, or `(StateChangeError, undefined)`
when a stream connection fails, or parsing or synchronous callback processing throws. Keep
callbacks synchronous; start async refresh work with its own
rejection handler. Exceptions from that error-handling callback
are not caught again.

| Field              | Meaning                                                            |
| ------------------ | ------------------------------------------------------------------ |
| `accountId`        | Account whose data changed.                                        |
| `entity`           | Server data type, such as `Email` or `Mailbox`.                    |
| `state`            | Opaque data-type state token, not a sequence number or object.     |
| `isPrimaryAccount` | Whether `accountId` equals the session's primary **mail** account. |

The client requests all types (`types=*`) and a persistent stream
(`closeafter=no`). It ignores messages whose `@type` is not
`StateChange`, including pings. It does not filter by configured
capability, account, or entity; filter in your handler.

Notifications contain invalidation information rather than full
records. Keep the state returned by your last successful `get`
or `changes` response and use it as `sinceState` in `Email.changes`;
then fetch created/updated IDs and remove destroyed IDs. A
notification's token belongs to that data type; it is not a query
state token for `queryChanges`. If the server reports
`cannotCalculateChanges`, fetch a fresh snapshot. Coordinate
refreshes so overlapping requests cannot overwrite newer data.
See [RFC 8620 §5.2](https://www.rfc-editor.org/rfc/rfc8620.html#section-5.2)
and [§7](https://www.rfc-editor.org/rfc/rfc8620.html#section-7).

## Reconnection and guarantees

The bundled `eventsource-client` transport reconnects on stream
completion and fetch failures, initially after two seconds; SSE
`retry` fields can change that delay. Received SSE IDs are sent
as `Last-Event-ID` on reconnect. HTTP 204 closes the connection.
Authentication, Fetch hooks and [connection hooks](../advanced/hooks.md#event-stream-connections) run again
for each connection. Connection failures also reach the handler as
`StateChangeError`, with the underlying error as `cause`, before
the transport retries. Intentional aborts do not report a connection
failure. Invalid responses are rejected before stream consumption;
HTTP 204 stops reconnecting without an after-connection hook.

The client provides no durable cursor storage, replay guarantee,
automatic data refresh, or deduplication. Resume/resynchronisation
belongs to the application and server protocol. Reconcile your
cached state after startup or interruptions instead of assuming
every intermediate notification arrived. See the transport's
[implementation](https://github.com/rexxars/eventsource-client/tree/v1.2.0)
and the [error reference](../reference/errors.md).
