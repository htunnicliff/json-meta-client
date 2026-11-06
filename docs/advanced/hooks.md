# Observe and transform requests

Hooks let you inspect or change work at three boundaries: HTTP requests,
complete JMAP batches, and event-stream connections. Choose the boundary that
contains the information you need. For example, an HTTP hook sees headers and
URLs, while a JMAP hook sees method invocations before they become JSON bytes.

Configure hooks as arrays under `hooks`. The client runs each array in order
and awaits each callback. Transform hooks must return the object passed to the
next hook. Only `afterEventSourceConnect` is an observer and returns nothing.

## Inspect HTTP requests and responses

Use `beforeFetch` to add headers and `afterFetch` to observe response metadata.
Authentication has already run when `beforeFetch` receives the request:

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail"],
  hooks: {
    beforeFetch: [
      ({ request }) => {
        request.headers.set(
          "X-Client-Version",
          "my-app/1.0",
        );
        return request;
      },
    ],
    afterFetch: [
      ({ request, response }) => {
        console.log(
          request.method,
          request.url,
          response.status,
        );
        return response;
      },
    ],
  },
});
await client.session;
```

These hooks cover session discovery and refresh, API requests, blob uploads
and downloads, and every event-stream connection or reconnect. They do not run
for individual stream messages.

`afterFetch` runs before status validation, including for HTTP errors. It can
return a replacement response, but it does not run if fetching fails without a
response. It receives a clone of the final outgoing request and the response
returned by the previous hook.

For an ordinary JSON response, inspect `response.clone()` to keep the original
body readable by the client. The same principle applies to request bodies.
Avoid logging credentials or private mail contents, and account for the memory
cost of copying bodies. Event streams need different treatment because they
can remain open indefinitely; see [stream body handling](#event-stream-connections).

## Inspect a complete JMAP batch

Use `beforeJmapRequest` for the assembled envelope and `afterJmapResponse` for
the parsed response, including method-level error invocations:

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: [],
  hooks: {
    beforeJmapRequest: [
      ({ request }) => {
        console.log(
          "Sending",
          request.methodCalls.map(([method]) => method),
        );
        return request;
      },
    ],
    afterJmapResponse: [
      ({ response }) => {
        console.log("Session state", response.sessionState);
        return response;
      },
    ],
  },
});
await client.api.Core.echo({ message: "hello" });
```

The request hook runs once per batch, after method-argument middleware and
session resolution, and before JSON serialisation. The response hook runs after
Fetch hooks, successful HTTP status checking, and JSON parsing. Each isolated
batch runs these hooks separately. Session discovery, blob helpers, and events
do not use JMAP envelope hooks.

The response hook receives the request returned by the last envelope request
hook. If a Fetch hook later changed the serialised body, that change is not
reflected in the structured request object. After all response hooks finish,
the client matches invocations by ID and settles individual call promises.

You can transform `using`, `createdIds`, and method invocations, but keep names
and invocation IDs aligned with the calls your application queued. Changing
them does not rename or enqueue client calls. A method-level `error` remains
visible in the response envelope before it becomes a rejected method promise.
There is no separate per-method result hook.

## Follow the request lifecycle

For a JMAP API request, processing follows this order:

1. Transform each method's arguments with built-in and custom middleware.
2. Assemble the batch and resolve the session.
3. Run `beforeJmapRequest`, then serialise the envelope.
4. Build the HTTP request and apply authentication.
5. Run `beforeFetch`, then send the request.
6. Run `afterFetch`, check HTTP status, and parse JSON.
7. Run `afterJmapResponse`, then resolve or reject each method call.

Other HTTP operations use steps 4–6 without envelope hooks or method results.
Event streams add connection hooks as described below. All hook arrays default
to empty.

A request hook can override authentication headers. A replacement `Request`
does not receive authentication again, so preserve the headers and abort signal
you need. To sign a final request, use the last `beforeFetch` hook, or the last
`beforeEventSourceConnect` hook for streams.

## Event-stream connections

`beforeEventSourceConnect` runs after authentication and all `beforeFetch`
hooks on each connection attempt. It receives stream headers, including any
`Last-Event-ID` used on a reconnect, and returns the next `Request`.

After `afterFetch`, the client validates the stream response: status `200`, a
`text/event-stream` content type with optional parameters, and an available,
unread, unlocked body. It then awaits `afterEventSourceConnect` observers before
reading messages. These observers receive `{ request, response }` and return
`void` or `Promise<void>`. They observe establishment, not messages or closure.

HTTP `204` runs Fetch response hooks and tells the transport to stop
reconnecting, without running after-connection hooks. Other invalid responses
raise `HttpError` before the body is read; available bodies are cancelled.

Keep stream bodies available in every response hook. Inspect headers instead
of reading, buffering a clone, locking, or cancelling the body. Reading to
completion can wait forever. If `afterFetch` replaces a stream response,
forward its body into the replacement rather than consuming it. Use the
[state-change handler](../features/events.md) for notifications and reported
connection failures.

## Handle hook failures at the right boundary

A throw or rejection stops the remaining hooks in that phase. Its effect
depends on where it occurred:

| Phase                                                         | Error delivery                                                                                                      |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Authentication, request construction, `beforeFetch`, or fetch | Existing `JsonMetaError` instances pass through; other errors become `NetworkError` with the original `cause`.      |
| `afterFetch` or either JMAP envelope hook                     | The original thrown value propagates. A batch failure rejects all its pending calls.                                |
| Event-stream connection processing                            | The handler receives `StateChangeError` with the underlying `cause`; the transport retains its reconnect behaviour. |

Session failures still reject the subscription setup promise. Intentional
stream aborts do not report connection failures. Abort or dispose a subscription
to stop further connection attempts. See the [error reference](../reference/errors.md)
for the available diagnostics.

## Update older hook names

Replace `hooks.beforeRequest` with `hooks.beforeFetch` and `hooks.afterResponse`
with `hooks.afterFetch`. Their exported types are now `BeforeFetchHook` and
`AfterFetchHook`; the old names have been removed. These callbacks still work
with Fetch objects and can be asynchronous.

Use JMAP envelope hooks for complete batches and connection hooks for stream
establishment. This version does not export `beforeMethodCall` or
`afterMethodResponse` hooks.

## Method-argument middleware

`Config.middleware` is an unstable, synchronous transformation API for individual
method arguments. It is separate from hooks, and no public `Middleware` type is
exported. Built-in result-reference rewriting and lazy mail-account injection
run before custom middleware; envelope hooks run afterwards.

An argument's injected `accountId` is lazy. Copying or enumerating that object
before the session loads can read the getter and throw. Keep this timing in mind
if you already use middleware. For observing a completed batch, the envelope
hooks avoid that earlier argument-transformation boundary.
