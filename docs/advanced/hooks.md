# Hooks

Hooks let you observe or change what the client sends and receives. They
work at two levels: HTTP hooks see each Fetch `Request` and `Response`, and
JMAP hooks see each batch's JMAP request and response envelopes.

You configure hooks once, in the client's `hooks` option:

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  auth: "<credentials>",
  sessionUrl: "<server>/.well-known/jmap",
  capabilities: ["mail", "submission"],
  hooks: {
    beforeFetch: [
      ({ httpRequest }) => {
        httpRequest.headers.set(
          "x-request-id",
          crypto.randomUUID(),
        );
        return httpRequest;
      },
    ],
    afterJmapResponse: [
      ({ jmapResponse }) => {
        console.log(
          "Session state",
          jmapResponse.sessionState,
        );
        return jmapResponse;
      },
    ],
  },
});
```

The hooks apply to every request the client makes, including requests made
through [isolated queues](./batching.md#isolated-queues).

## Lifecycle overview

Every HTTP request the client makes goes through these steps, in order:

1. **`auth`**: the client applies the [`auth`](../reference/api.md#auth)
   option, setting the `authorization` header or running your callback.
2. **`beforeFetch`** hooks.
3. **`beforeEventSourceConnect`** hooks, for event-stream connections only.
4. **`fetch`**: the request is sent.
5. **`afterFetch`** hooks.
6. **Stream validation**, for event-stream connections only: unless the
   server answered `204 No Content`, the response must be a `200` with a
   `text/event-stream` content type and an unread body.
7. **`afterEventSourceConnect`** hooks, for validated event-stream
   connections only.
8. **Status check**: a response that isn't successful becomes an
   `HttpError`.
9. **JSON parse**, for responses read as JSON: the session, method calls,
   and uploads. Downloads and event streams return the `Response` itself.

A batch of method calls adds JMAP hooks around its HTTP request:

1. The batch's calls are queued, the session is loaded, and each call gets
   its default `accountId`.
2. **`beforeJmapRequest`** hooks.
3. The [transport](./transports.md) sends the envelope. With the default
   `httpTransport()`, that is the HTTP steps above, posting to the session's
   `apiUrl`. With `webSocketTransport()`, it goes over the socket, and no
   HTTP hooks run.
4. **`afterJmapResponse`** hooks.
5. Each method call settles from its matching
   [response](./batching.md#matching-responses).

The first batch also loads the session, so its own HTTP request, with its
own `beforeFetch` and `afterFetch` hooks, comes before the batch's JMAP
hooks.

## Hooks by transport

`beforeJmapRequest` and `afterJmapResponse` run for every batch, whatever
the [transport](./transports.md). The HTTP hooks run only for HTTP requests:

| Hook                         | `httpTransport()`                     | `webSocketTransport()`                             |
| ---------------------------- | ------------------------------------- | -------------------------------------------------- |
| `beforeJmapRequest`          | Every batch                           | Every batch                                        |
| `afterJmapResponse`          | Every batch                           | Every batch                                        |
| `beforeFetch` / `afterFetch` | Session, batches, blobs, event stream | Session, blobs, event stream (not the socket)      |
| Event-source hooks           | Event stream                          | Event stream, when the server doesn't support push |

## Common rules

Every hook option takes an array of functions, and the client runs them one
at a time, in array order. A hook can be `async`: the client awaits it
before running the next one.

Each hook receives what the previous one returned, and must return the value
to use from then on: the request or response it was given, a modified one,
or a new one. The exception is `afterEventSourceConnect`, which only
observes and returns nothing.

## `beforeFetch` / `afterFetch`

The fetch hooks run on every HTTP request the client makes: loading the
session, sending a batch of method calls, uploading and downloading blobs,
and connecting to the event stream, including every reconnect. They don't
see WebSocket traffic: with `webSocketTransport()`, batches go over the
socket instead.

`beforeFetch` receives the authenticated `httpRequest` and returns the
`Request` to send. Headers can be set on it directly. To change anything
else, return a new `Request` built from it.

`afterFetch` receives the `httpResponse` and returns the `Response` the
client continues with. It runs before the status check and before the body
is parsed, so it can rewrite or repair a response. It also receives
`httpRequest`, a copy of the request that was sent, taken before the fetch,
so its body can still be read.

This hook retries a request once when the server is briefly unavailable:

```ts
import type { AfterFetchHook } from "json-meta-client";

const retryUnavailable: AfterFetchHook = async ({
  httpRequest,
  httpResponse,
}) => {
  if (httpResponse.status !== 503) return httpResponse;
  await new Promise((resolve) =>
    setTimeout(resolve, 1_000),
  );
  return fetch(httpRequest);
};
```

The retried request already carries the `auth` header and the changes from
`beforeFetch`, and it is sent with the global `fetch`, so the hooks don't
run on it a second time.

## `beforeJmapRequest` / `afterJmapResponse`

The JMAP hooks run once per batch, on the whole envelope rather than the
HTTP request. They don't run on other HTTP requests, such as loading the
session or transferring blobs.

`beforeJmapRequest` receives the `jmapRequest` that is about to be sent,
with its `using` URNs and `methodCalls`. Default account IDs are already
filled in. Return the envelope to send, for example with `createdIds` added:

```ts
import type { BeforeJmapRequestHook } from "json-meta-client";

const sendCreatedIds: BeforeJmapRequestHook = ({
  jmapRequest,
}) => ({
  ...jmapRequest,
  createdIds: {},
});
```

`afterJmapResponse` receives the parsed `jmapResponse`, along with the
`jmapRequest` that was sent after every `beforeJmapRequest` hook ran. It
runs before any method call settles, so whatever it returns is what the
calls are settled from. This hook logs the methods in each batch:

```ts
import type { AfterJmapResponseHook } from "json-meta-client";

const logBatch: AfterJmapResponseHook = ({
  jmapRequest,
  jmapResponse,
}) => {
  const methods = jmapRequest.methodCalls.map(
    ([method]) => method,
  );
  console.debug(
    methods.join(", "),
    "→",
    jmapResponse.sessionState,
  );
  return jmapResponse;
};
```

A batch whose calls were all rejected before sending, such as by
[`cancelBatch()`](./batching.md#cancelling), sends no request and runs no
JMAP hooks.

## `beforeEventSourceConnect` / `afterEventSourceConnect`

The event-source hooks run on the connection that
[`onStateChange()`](../features/events.md#subscribing) opens, every time it
connects, including each reconnect.

`beforeEventSourceConnect` works like `beforeFetch`, and runs after it. Use
it for changes that only the event stream needs:

```ts
import type { BeforeEventSourceConnectHook } from "json-meta-client";

const markStream: BeforeEventSourceConnectHook = ({
  httpRequest,
}) => {
  httpRequest.headers.set(
    "x-client-stream",
    "state-changes",
  );
  return httpRequest;
};
```

`afterEventSourceConnect` runs once the connection is validated as an open
event stream, after `afterFetch`. It doesn't run when the server answers
`204 No Content` or with a response that isn't an event stream. It can
observe the response, such as its headers, but can't replace it. Leave the
body unread: the client streams events from it once the hook returns.

```ts
import type { AfterEventSourceConnectHook } from "json-meta-client";

const logConnect: AfterEventSourceConnectHook = ({
  httpResponse,
}) => {
  console.debug(
    "Event stream connected",
    httpResponse.headers.get("date"),
  );
};
```

## Errors in hooks

What an error thrown in a hook becomes depends on when the hook runs:

- **Before the fetch**, in `auth`, `beforeFetch`, or
  `beforeEventSourceConnect`, the client wraps the error in a
  `NetworkError` whose `cause` is the original error. An error that is
  already one of the library's own, a `JsonMetaError`, is passed through
  unchanged instead.
- **After the fetch**, in `afterFetch` or `afterEventSourceConnect`, the
  error is passed through unchanged.
- **In a JMAP hook**, the error rejects every method call in the batch,
  unchanged.

The error reaches whatever made the request: the `session` promise, the
pending method calls, or the blob method's promise. For the event stream,
the `onStateChange()` handler receives a `StateChangeError` whose `cause` is
that error.

## Recipes

### Logging

Log every HTTP request with its status, using `afterFetch`, which sees both
the request and the response:

```ts
const logHttp: AfterFetchHook = ({
  httpRequest,
  httpResponse,
}) => {
  console.debug(
    httpRequest.method,
    httpRequest.url,
    httpResponse.status,
  );
  return httpResponse;
};
```

For a log of method calls rather than HTTP requests, use `afterJmapResponse`
as in the `logBatch` hook above.

### Request IDs and tracing headers

Add a header in `beforeFetch` to tag every request, as the client at the top
of this page does with `x-request-id`. Every reconnect of the event stream
runs the hook again, so each connection gets its own ID.

### Inspecting request bodies

To capture the JMAP request a batch sends, such as for a test snapshot, read
it in `beforeJmapRequest`, where it is already an object:

```ts
const sentRequests: unknown[] = [];

const recordRequest: BeforeJmapRequestHook = ({
  jmapRequest,
}) => {
  sentRequests.push(structuredClone(jmapRequest));
  return jmapRequest;
};
```

To see the raw HTTP body instead, read a clone in `beforeFetch`, such as
`await httpRequest.clone().json()`, and return the original. Reading the
original request's body would leave nothing to send.

### Refreshing tokens

Don't refresh credentials in a hook. Pass a callback as the
[`auth`](../reference/api.md#auth) option instead. It runs before every
HTTP request, including event-stream reconnects, and can await a token
refresh before setting the header.
