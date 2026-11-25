# Events

## Subscribing

A JMAP server can push a notice whenever data changes, such as when a new
email arrives. Subscribe with `client.onStateChange()`:

```ts
let mailboxState = (
  await client.api.Mailbox.get({ ids: [] })
).state;

const subscription = await client.onStateChange(
  async (error, change) => {
    if (error) {
      console.error(error);
      return;
    }

    // Refresh unread counts only when mailboxes have new data
    if (
      change.entity === "Mailbox" &&
      change.state !== mailboxState
    ) {
      mailboxState = change.state;
      const mailboxes = await client.api.Mailbox.get({
        properties: ["name", "unreadEmails"],
      });
      for (const { name, unreadEmails } of mailboxes.list) {
        console.log(`${name}: ${unreadEmails} unread`);
      }
    }
  },
);
```

With the default HTTP transport, the client connects to the session's
`eventSourceUrl`, an [event stream](https://www.rfc-editor.org/rfc/rfc8620#section-7.3) that
stays open. It subscribes to every type (`types: "*"`) and keeps the
connection open after each change (`closeafter: "no"`).

The client reads the stream itself. It reconnects when the stream ends or
the network fails, sending `Last-Event-ID` when the server gave events an
`id`. It waits the server's `retry` time (2 seconds by default) before
reconnecting, and backs off, with jitter, after failures in a row. If
nothing arrives for two ping intervals, the client treats the connection
as dead and reconnects. If the server refuses the connection, with an HTTP
error or a response that isn't an event stream, the client reports a
`StateChangeError` and stops. Every failure reaches your handler as a
`StateChangeError`.

::: note
The client reads the stream with `fetch` instead of the browser's built-in
`EventSource`, because `EventSource` can't send custom headers. Without
them, the event stream couldn't carry the `Authorization` header that
[`auth`](../reference/api.md#auth) sets on every other request.
:::

`onStateChange()` takes an optional second argument:

- **`signal`**: an `AbortSignal` that closes the connection when aborted. See
  [Unsubscribing](#unsubscribing).
- **`pingSeconds`**: how often, in seconds, the server should send a ping to
  keep the event stream alive. Defaults to `30`. WebSocket push ignores it
  and sends its own heartbeat instead; see
  [Transports](../advanced/transports.md#push).

## Push channels

State changes arrive on one of two push channels:

- **WebSocket push**, when the client uses `webSocketTransport()` and the
  session's WebSocket capability sets `supportsPush`. It shares the socket
  that carries method calls. See [Transports](../advanced/transports.md#push).
- **The event stream** otherwise, as described above.

With the default HTTP transport, which is the recommended choice, state
changes use the event stream. You don't need the WebSocket transport to
receive them.

Handlers share a channel. The client opens one WebSocket push subscription
for all of them, or one event stream for each distinct `pingSeconds` value,
and closes it when the last handler leaves. A handler that throws doesn't
stop delivery to the others.

## The handler

The handler is called Node-style, with an error first and the change second.
When `error` is `null`, `change` is a `StateChangePayload`:

| Property           | Type      | Description                                              |
| ------------------ | --------- | -------------------------------------------------------- |
| `accountId`        | `string`  | The account where the change happened                    |
| `entity`           | `string`  | The type that changed, such as `"Email"` or `"Mailbox"`  |
| `state`            | `string`  | The new state of that type                               |
| `isPrimaryAccount` | `boolean` | Whether the account is the default account for that type |

A server's `StateChange` message can report several types in several
accounts at once. The client calls the handler once for each type in each
account.

`isPrimaryAccount` is worked out per type. It is `true` when an
`Entity/get` call without an `accountId` would go to that account, by the
same rules the client uses to [fill in account IDs](./method-calls.md#account-ids).
So if the mail primary account is A and the contacts primary account is B:

- An `Email` change in A and a `ContactCard` change in B are primary.
- An `Email` change in B and a `ContactCard` change in A are not.

`isPrimaryAccount` is `false` when the default account would be ambiguous:
several accounts qualify and the session names no primary account.

## Reacting to changes

A state change says only that something changed. To find out what, keep
the last state you have seen, pass it as `sinceState` to the type's
`/changes` method, and then remember the new `state`:

```ts
let emailState = (await client.api.Email.get({ ids: [] }))
  .state;

await client.onStateChange(async (error, change) => {
  if (
    error ||
    change.entity !== "Email" ||
    !change.isPrimaryAccount
  ) {
    return;
  }

  const changes = client.api.Email.changes({
    sinceState: emailState,
  });
  emailState = change.state;

  const created = await client.api.Email.get({
    ids: changes.resultRef("/created"),
    properties: ["subject", "from"],
  });
  for (const email of created.list) {
    console.log("New email:", email.subject);
  }
});
```

`Email/changes` and `Email/get` are sent together in one request, with the
created IDs passed by a [result reference](./method-calls.md#result-references).

## Errors

Problems with the stream reach the handler as a
[`StateChangeError`](../reference/errors.md), with `change` set to
`undefined`:

- A message the client can't read, such as malformed JSON, gives a
  `StateChangeError` whose `cause` is the parsing error. Delivery continues
  with the next message.
- A failed connection gives a `StateChangeError` whose `cause` is an
  `HttpError`, when the server answers with an error status or a response
  that isn't an event stream, or a `NetworkError`, when the request couldn't
  be made.

```ts
import { isHttpError } from "json-meta-client";

await client.onStateChange((error, _change) => {
  if (
    error &&
    isHttpError(error.cause) &&
    error.cause.status === 401
  ) {
    console.error(
      "Sign in again to keep receiving changes",
    );
  }
});
```

Closing the connection yourself, with the signal or by disposing the
subscription, is not reported as an error.

## Reconnects

When the connection drops, the stream reconnects automatically. Each
reconnect is a new request that goes through
[`auth`](../reference/api.md#auth) and the
[fetch and event source hooks](../advanced/hooks.md) again, so a callback
that refreshes credentials keeps the stream authenticated.

If the server answers a connection with HTTP `204 No Content`, the stream
stops and doesn't reconnect.

WebSocket push reports a dropped socket to the handler as a
`StateChangeError`, then reconnects with backoff and resumes from the last
`pushState` the server sent.

## Unsubscribing

`onStateChange()` resolves to a `Disposable`. Dispose of it to close the
connection. With a `using` declaration, that happens when the scope ends:

```ts
async function watchFor(ms: number) {
  using _subscription = await client.onStateChange(
    (error, change) => {
      if (!error) console.log(change.entity, change.state);
    },
  );
  await new Promise((resolve) => setTimeout(resolve, ms));
} // The connection closes here
```

Disposing the client with `client[Symbol.dispose]()` ends every
subscription. You can also close one directly, or with an abort signal:

```ts
subscription[Symbol.dispose]();

const controller = new AbortController();
await client.onStateChange(() => {}, {
  signal: controller.signal,
});
controller.abort();
```
