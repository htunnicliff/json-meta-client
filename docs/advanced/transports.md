# Transports

A transport carries each [batch](./batching.md) to the server as one JMAP
Request and brings back its JMAP Response. It can also carry state changes
back from the server. The client uses HTTP unless you choose another
transport.

## Choosing a transport

The `transport` option takes a transport factory. The client calls it once,
when it is constructed, so two clients never share a connection.

| Factory                | Requests                        | State changes                                                        |
| ---------------------- | ------------------------------- | -------------------------------------------------------------------- |
| `httpTransport()`      | HTTP `POST` to `apiUrl`         | The event stream                                                     |
| `webSocketTransport()` | One shared WebSocket (RFC 8887) | WebSocket push if the server supports it, otherwise the event stream |

::: tip Prefer the HTTP transport
Use the default `httpTransport()` unless you have a specific reason not to.
It is the simpler and more predictable choice. Each batch is an ordinary HTTP
request that your `auth`, hooks and platform tooling all see. The WebSocket
transport is a long-lived connection with more moving parts: request
timeouts, heartbeats, reconnects with backoff, idle closing, and
authentication that varies by `WebSocket` implementation. Choose it only
when you need something only it provides, such as WebSocket push or one
connection shared by every batch.
:::

`httpTransport()` is the default, so these two clients behave the same:

```ts
import {
  httpTransport,
  JsonMetaClient,
  webSocketTransport,
} from "json-meta-client";
import type {
  JmapResponse,
  TransportFactory,
} from "json-meta-client";

const viaDefault = new JsonMetaClient({
  sessionUrl: "https://<something>/.well-known/jmap",
  auth: "<token>",
  capabilities: ["mail"],
});

const viaHttp = new JsonMetaClient({
  sessionUrl: "https://<something>/.well-known/jmap",
  auth: "<token>",
  capabilities: ["mail"],
  transport: httpTransport(),
});
```

The client never switches transports on its own. If you choose the WebSocket
transport and the session doesn't advertise
`urn:ietf:params:jmap:websocket`, every batch rejects with a
`ConfigurationError`.

## The WebSocket transport

The HTTP transport is the recommended default; see
[Choosing a transport](#choosing-a-transport).

`webSocketTransport()` opens one socket per client, at the URL in the
session's `urn:ietf:params:jmap:websocket` capability, with the `jmap`
subprotocol. Every batch of the client shares it, including batches from
`client.isolated()`.

```ts
import WebSocket from "ws";

const wsClient = new JsonMetaClient({
  sessionUrl: "https://<something>/.well-known/jmap",
  auth: "<token>",
  capabilities: ["mail"],
  transport: webSocketTransport({
    createWebSocket: (url, protocols, headers) =>
      new WebSocket(url, protocols, { headers }),
  }),
});
```

The socket's lifecycle:

- **Connecting.** The socket opens on the first batch. Batches made while it
  connects wait for it, then share it.
- **Responses.** Each JMAP Request carries an id, and each response settles
  the request with that id, so the server may answer in any order. A
  `RequestError` from the server rejects only its own request, with a
  `JmapError`.
- **Closing.** When the socket closes unexpectedly, every request still in
  flight rejects with a `NetworkError`. The client doesn't resend them,
  because a `/set` call may already have been applied. The next batch
  reconnects.
- **Dead sockets.** A request that gets no response within
  `requestTimeoutSeconds` (default `60`), or a message from the server that
  can't be parsed, means the socket can't be trusted: the transport closes
  it, and every request on it rejects with a `NetworkError`.
- **Idle timeout.** The socket closes after `idleSeconds` (default `60`) with
  no requests in flight and no push subscription. Pass `Infinity` to keep it
  open until the client is disposed.
- **Session refresh.** If a refreshed session names a different WebSocket
  URL, new batches go to a new socket. The old one closes once its requests
  settle.

### Authentication

The transport applies `auth` to a request for the socket URL and passes the
resulting headers to `createWebSocket`. What happens next depends on the
`WebSocket` implementation:

- **The `ws` package** takes headers as an option, as in the example above.
- **Node's global `WebSocket`** has no headers option in its standard
  constructor; use `ws` when the server needs an `Authorization` header.
- **Browsers** can't send headers on a WebSocket at all. Without
  `createWebSocket`, the transport uses the global `WebSocket` and sends no
  headers, so the server must accept the browser's cookies instead. Bearer
  tokens and Basic credentials from `auth` don't reach the socket there.

### Push

When the session's WebSocket capability sets `supportsPush`,
[`onStateChange`](../features/events.md) uses the same socket: the transport
sends `WebSocketPushEnable` for every data type and delivers each
`StateChange` to your handlers. `onStateChange` resolves once the socket is
open and push is enabled on it. RFC 8887 has no acknowledgment for
`WebSocketPushEnable`, so a change another client makes right after
`onStateChange` resolves can still be missed. A change sent over the same
client's socket afterward is not.

While anyone is subscribed, the socket stays open past the idle timeout. RFC
8887 has no ping, so the transport sends a `Core/echo` heartbeat every
`heartbeatSeconds` (default `30`) to notice a socket that has silently died,
as after a laptop sleeps. Heartbeats don't run the JMAP hooks. When the socket
drops or misses a heartbeat, handlers receive a `StateChangeError`, and the
transport reconnects and resumes from the last `pushState` the server sent.
The wait between attempts doubles from one second up to 30 seconds, and
resets only once a new socket receives a message, so a server that accepts
sockets and then closes them is retried less and less often. `pingSeconds`
applies only to the event stream.

When the server doesn't support push, state changes come from the event
stream, as with HTTP.

### Hooks

`beforeJmapRequest` and `afterJmapResponse` run for every batch, whatever the
transport. `beforeFetch` and `afterFetch` don't see WebSocket traffic: only
the session request, blob transfers and the event stream go over HTTP.

## Closing the client

`client[Symbol.dispose]()` releases the client's connections. Requests in
flight, including blob transfers and session requests, reject with
`CancellationError`, every `onStateChange` subscription ends, and the
transport closes its sockets. Later calls also reject with
`CancellationError`. A client declared with `using` is disposed when it goes
out of scope:

```ts
{
  using scoped = new JsonMetaClient({
    sessionUrl: "https://<something>/.well-known/jmap",
    auth: "<token>",
    capabilities: ["mail"],
    transport: webSocketTransport(),
  });
  await scoped.api.Mailbox.get({ ids: null });
}
```

## Writing a transport

A transport factory receives a `TransportContext` and returns a `Transport`.

<<< ../../src/transports/types.ts#transport-factory

The context gives the transport the client's authentication, and a `fetch`
that also runs the fetch hooks and rejects with `HttpError` or
`NetworkError`:

<<< ../../src/transports/types.ts#transport-context

<<< ../../src/transports/types.ts#transport

<<< ../../src/transports/types.ts#push-events

Some rules a transport should follow:

- `send` receives the Request after `beforeJmapRequest` has run, and its
  Response goes through `afterJmapResponse`. Any envelope fields the
  transport needs on the wire are its own business.
- `send` receives the current session on every call, so the transport can
  follow a refreshed session.
- Reject an aborted `send` with `CancellationError`. The signal belongs to
  that send: it aborts when the client is disposed today, but don't treat it
  as the end of the transport. The client disposes the transport separately.
- Reject other failures with a `JsonMetaError` subclass. The client turns any
  other error into a `CancellationError` once the signal has aborted, or a
  `NetworkError` otherwise, with the original as its `cause`. A `send` that
  resolves with something other than a JMAP Response rejects with
  `UnknownError`.
- The client calls `subscribe` at most once for all of its `onStateChange`
  handlers, and disposes what it returns when the last one leaves. Return
  `null`, or leave `subscribe` out, to use the event stream. Return a promise
  for the `Disposable` to make `onStateChange` wait until the channel is
  ready.
- On a runtime without `Symbol.dispose`, the client looks for a `disconnect`
  method instead of `[Symbol.dispose]`, on the transport and on what
  `subscribe` returns. The types allow either: `Transport` has an optional
  `disconnect`, and `subscribe` may return a `DisposableLike`.

This transport sends each batch as an HTTP `POST` with its own logging, and
leaves state changes to the event stream:

```ts
const loggingTransport: TransportFactory = (context) => ({
  send: async (request, { session, signal }) => {
    console.log(
      "Sending",
      request.methodCalls.length,
      "method calls",
    );
    const response = await context.fetch(session.apiUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
    const payload: JmapResponse = await response.json();
    return payload;
  },
});

const loggingClient = new JsonMetaClient({
  sessionUrl: "https://<something>/.well-known/jmap",
  auth: "<token>",
  capabilities: ["mail"],
  transport: loggingTransport,
});
```
