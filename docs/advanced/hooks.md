# Hooks

Configure hooks through `Config.hooks`. Each array runs in
order, and asynchronous hooks are awaited before continuing.
Transformers must return the object to pass to the next hook;
observers return nothing.

| Hook                       | Arguments                                          | Return                                    | Scope                                        |
| -------------------------- | -------------------------------------------------- | ----------------------------------------- | -------------------------------------------- |
| `beforeFetch`              | `{ request: Request }`                             | `Request` or `Promise<Request>`           | Every outgoing HTTP request                  |
| `afterFetch`               | `{ request: Request, response: Response }`         | `Response` or `Promise<Response>`         | Every received HTTP response                 |
| `beforeJmapRequest`        | `{ request: JmapRequest }`                         | `JmapRequest` or `Promise<JmapRequest>`   | One assembled JMAP batch                     |
| `afterJmapResponse`        | `{ request: JmapRequest, response: JmapResponse }` | `JmapResponse` or `Promise<JmapResponse>` | One parsed JMAP response envelope            |
| `beforeEventSourceConnect` | `{ request: Request }`                             | `Request` or `Promise<Request>`           | Every stream connection attempt or reconnect |
| `afterEventSourceConnect`  | `{ request: Request, response: Response }`         | `void` or `Promise<void>`                 | Every validated stream connection            |

`JmapRequest` and `JmapResponse` above refer to the RFC envelope
types, rather than Fetch objects. Hook types are exported
from `json-meta-client`.

```ts
const client = new JsonMetaClient({
  sessionUrl,
  capabilities: ["mail"],
  auth: { token },
  hooks: {
    beforeFetch: [
      ({ request }) => {
        request.headers.set("X-Client", "my-app");
        return request;
      },
    ],
    afterJmapResponse: [
      ({ response }) => {
        console.log(response.sessionState);
        return response;
      },
    ],
    afterEventSourceConnect: [
      ({ request, response }) => {
        console.log(
          "Connected",
          request.url,
          response.status,
        );
      },
    ],
  },
});
```

## Fetch ordering

Fetch hooks cover session discovery and refresh, API calls,
blob uploads and downloads, and event-stream connections and
reconnects. They do not run per event-stream message.

For each HTTP operation:

1. Create the Fetch request with its transport headers and
   body.
2. Apply and await [authentication](../features/authentication.md).
3. Run deprecated `beforeRequest` hooks, then `beforeFetch`
   hooks.
4. For event streams, run `beforeEventSourceConnect` hooks.
5. Send the resulting request.
6. Run deprecated `afterResponse` hooks, then `afterFetch`
   hooks, with a clone of the final outgoing request and the
   response returned by the preceding hook.
7. Validate the resulting response. Ordinary HTTP operations
   reject non-success statuses; JSON operations then parse
   the body. Event streams follow the connection rules below.

Request hooks may inspect or override authentication headers.
To sign the final request, use the last `beforeFetch` hook,
or the last `beforeEventSourceConnect` hook for stream
requests. Returning a replacement request does not reapply
authentication; preserve the headers and abort signal you
need.

`afterFetch` runs before status validation, including on
HTTP errors, and may replace a response to recover from an
error. It does not run when fetching fails without a response.
To inspect a JSON body, read `response.clone().json()` and
return the original response. Blob bodies must remain
available to the caller.

## JMAP envelopes and batching

Built-in transformations and custom `middleware` run on each
method's arguments before batching. `beforeJmapRequest` runs
once on the assembled envelope, after session resolution and
before serialization. Authentication and Fetch hooks see its
serialized output. Separate batches, including batches from
`client.isolated`, run their own envelope hooks.

`afterJmapResponse` receives the request envelope returned by
the final `beforeJmapRequest` hook and the parsed response.
The request is the structured envelope before any Fetch hook
changes to the serialized body. It runs after Fetch hooks,
HTTP success validation, and JSON parsing. It does not run
for session discovery, blob operations, event streams, HTTP
errors, or JSON parsing failures.

Envelope hooks can observe or transform the whole batch,
including `using`, `createdIds`, and method invocations. Keep
invocation IDs and method names aligned with queued calls;
changing them does not rename or enqueue client calls.
After response hooks finish, the client matches responses to
queued calls by ID and resolves or rejects each method result.
JMAP method errors remain part of the response envelope and
are visible to `afterJmapResponse` before becoming individual
promise rejections. A hook can deliberately transform those
results, but it does not run separately for each result.

## Event-stream connections

`beforeEventSourceConnect` runs after authentication and all
Fetch request hooks on each attempt, including reconnects.
The request includes transport headers such as
`Last-Event-ID` when reconnecting after a named event.

`afterFetch` runs on the incoming response before validation.
`afterEventSourceConnect` then runs only for status `200`, a
`text/event-stream` content type (optional parameters are
allowed), and an available, unread, unlocked body. Its async
work completes before the client reads any messages. It
observes establishment, rather than stream closure or
individual messages. It cannot return a replacement response.

HTTP `204` tells the event-source client to stop reconnecting;
it runs Fetch response hooks but no connection after hooks.
Other invalid stream responses raise `HttpError` without
reading the body. Their available bodies are cancelled.

All stream response hooks must preserve the streaming body.
Inspect headers rather than reading, cloning for buffering,
locking, or cancelling the body. To replace a response in
`afterFetch`, forward its body with `new Response(response.body,
{ status: response.status, headers })`. Reading a stream to
completion can block forever. Connection hooks do not add
message, disconnect, or error hook arrays; use the
`onStateChange` handler for changes and reported failures.

## Errors

A thrown error or rejected promise stops the remaining hooks
in that phase.

- Authentication, request construction, request hooks, and
  Fetch failures preserve existing behavior: `JsonMetaError`
  instances propagate, and other failures become
  `NetworkError` with the original error as `cause`.
- Fetch response hooks and JMAP envelope hooks propagate
  their original errors. An envelope or transport failure
  rejects every pending method call in that batch.
- Event-stream connection failures, including hook and
  validation errors, reach the state-change handler as
  `StateChangeError`, with the underlying error as `cause`.
  The event-source client retains its reconnect behavior.
  Abort or dispose the subscription to stop it. Intentional
  aborts do not report a connection failure. Session discovery
  failures still reject the `onStateChange` setup promise.

## Migrating existing hooks

`beforeRequest` and `afterResponse` remain supported with
their existing arguments, returns, and error behavior, but
are deprecated. Rename them to `beforeFetch` and `afterFetch`;
rename imported `BeforeRequestHook` and `AfterResponseHook`
types to `BeforeFetchHook` and `AfterFetchHook`.

When both names are configured, the legacy array runs first,
followed by the new array. All entries run, even if the same
function appears in both arrays. Configure a function once
when migrating. No removal is scheduled by this change.
