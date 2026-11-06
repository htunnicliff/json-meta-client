# API reference

Import runtime APIs and types from `"json-meta-client"`. This page describes
client operations and their defaults. The [type reference](./types.md) lists
exported types, and the [error reference](./errors.md) covers error classes and
guards. Internal RFC modules, built-in descriptors, and pending-call classes
have no public package subpath.

## `new JsonMetaClient(options)`

Creates a client synchronously. Construction does not fetch a session.
Configured capability literals determine the method and session types, and
Core is always included. The instance is frozen after construction.

| Option         | Type and default                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------------- |
| `sessionUrl`   | Required `string` or `URL`; must parse as a URL. The session endpoint.                              |
| `auth`         | Required [`Auth`](./types.md#authentication): bearer credentials, Basic credentials, or a callback. |
| `capabilities` | Required readonly array of built-in keys or custom descriptors. `[]` retains Core.                  |
| `hooks`        | Optional object containing the hook arrays below. Each array defaults to `[]`.                      |
| `middleware`   | Optional readonly array of synchronous method-argument transformations; defaults to `[]`. Unstable. |

Authentication requires a non-empty token, or a non-empty Basic username and a
string password. Basic usernames cannot contain colons; passwords may be empty.
Invalid authentication, session URL, capability configuration, or middleware
can throw synchronously. See [authentication](../features/authentication.md)
and the [capability catalogue](./capabilities.md).

### Hook arrays

| Key under `hooks`          | Input and return                                                                        |
| -------------------------- | --------------------------------------------------------------------------------------- |
| `beforeFetch`              | `{ request: Request }` → `Request` or promise.                                          |
| `afterFetch`               | `{ request: Request; response: Response }` → `Response` or promise.                     |
| `beforeJmapRequest`        | `{ request: JmapRequest }` → JMAP request envelope or promise.                          |
| `afterJmapResponse`        | `{ request: JmapRequest; response: JmapResponse }` → JMAP response envelope or promise. |
| `beforeEventSourceConnect` | Same signature as `beforeFetch`.                                                        |
| `afterEventSourceConnect`  | `{ request: Request; response: Response }` → `void` or promise.                         |

Each array runs sequentially and awaits asynchronous callbacks. Fetch hooks
cover all HTTP transports, including stream reconnects. JMAP hooks surround a
complete batch; connection hooks surround stream establishment. `JmapRequest`
and `JmapResponse` above describe protocol envelopes, not exported type names.
The [hook guide](../advanced/hooks.md) defines ordering, body handling, and
failure propagation.

## `client.api`

The typed API exposes configured methods plus Core. Each method has the call
shape `method(args, options?)`, where `args` follows its capability contract and
`options` is `{ id?: string }`. A missing invocation ID becomes a generated
string beginning with the method name. Explicit IDs must be distinct within
a request.

Calling a method queues it synchronously and returns an augmented promise.
The queue flushes in the next microtask. Awaiting returns the method's response
arguments, without the enclosing JMAP response envelope or pending-call helpers.
Selected properties and typed references can affect the inferred result.

For methods with an `accountId` argument, the property may be omitted. The client
then supplies `session.primaryAccounts["urn:ietf:params:jmap:mail"]`, regardless
of the method's capability. An explicit `accountId: undefined` prevents that
injection; omit the property to request the default. See
[account selection](../features/capabilities.md#check-support-and-choose-an-account).

### Pending-call members

| Member                     | Contract                                                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `then`, `catch`, `finally` | Standard promise operations.                                                                                                 |
| `$id`                      | Readonly invocation ID string.                                                                                               |
| `$method`                  | Readonly method name, such as `Email/get`.                                                                                   |
| `$args`                    | Readonly property exposing transformed arguments; the object is not a deep-frozen snapshot.                                  |
| `resultRef(pointer)`       | A `{ resultOf, name, path }` reference carrying the selected value's type. Does not read or await a result.                  |
| `createdRef(id)`           | On set calls, returns `#` followed by a key from that call's `create` map. An unknown key throws `RangeError` synchronously. |

Reference producers must precede consumers in the same request. The client does
not check dependency relationships across requests or queues. Argument
transformation can throw synchronously, including when middleware returns a
non-object. Request and method failures reject promises; per-object set
failures remain in fulfilled results. See [method calls](../features/method-calls.md)
and [batching](../advanced/batching.md).

## Session access

### `client.session`

Returns `Promise<ClientSession<Capabilities>>`. On first access, fetches the
session and caches the promise. Concurrent readers share it. A rejected promise
also stays cached until replaced by `refreshSession()`.

The first successful load warns about configured capabilities missing from the
server. It does not validate response schemas or reject the session for missing
capabilities. Later refreshes do not repeat that capability check.

### `client.refreshSession()`

Always fetches a new session, replaces the cached promise, and returns it.
The configured API is unchanged. Session-state changes in method responses do
not trigger an automatic refresh.

Both operations can reject for network, HTTP, body-reading, or JSON parsing
failures. Session objects describe accounts, capability metadata, service URLs,
and session state; see [session types](./types.md#client-types).

## Blob helpers

The helpers use HTTP URL templates from the session and do not require the
`"blob"` capability. Both load the session, apply authentication and Fetch
hooks, and default to the primary mail account. Neither accepts per-call request
options or an abort signal.

### `client.blob.upload(body, params = {})`

`body` is `BodyInit`. `params` is `{ accountId?: string }`.

POSTs the body and resolves to an object with `accountId: string`,
`blobId: string`, `type: string`, and `size: number`. The response is parsed
as JSON. The body is sent directly, without JSON or Base64 encoding.

### `client.blob.download(params)`

`params` is `{ blobId: string; name: string; type: string; accountId?: string }`.

GETs the expanded URL and resolves to a Fetch `Response` with an unread body.
The caller chooses a body reader. Both helpers can reject for session,
URI-template, network, or HTTP failures; upload can also reject while parsing
JSON. See [file transfers](../features/blobs.md) for body and media-type examples.

## State-change subscriptions

### `client.onStateChange(handler, options = {})`

Returns `Promise<Disposable>`. Loads the session and creates an event-stream
subscription for all data types. Resolution means the subscription object
exists, not that a stream has connected. Setup failures reject the promise;
later connection and message-processing failures reach the handler.

| Option        | Contract                                                                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `signal`      | Optional `AbortSignal`. An abort event closes the stream. An already-aborted signal is not checked at registration.                |
| `pingSeconds` | Optional number; defaults to `30`. Rounded to an integer string in the URL. Requests a server ping interval, not a client timeout. |

The handler receives `(null, StateChangePayload)` for each account/entity pair,
or `(StateChangeError, undefined)` for a connection or parsing/processing
failure. Synchronous errors from the success handler use the error path;
asynchronous handler results are not awaited. Intentional aborts do not report
a connection failure.

Calling the returned resource's `[Symbol.dispose]()` closes the stream. Runtimes
without that symbol use a `disconnect` fallback. Each subscription has its own
lifetime; batch cancellation does not close streams. See
[events](../features/events.md) for filtering, cleanup, and reconnection.

## Cancellation and isolation

### `client.cancelBatch(): void`

Rejects all calls still queued on `client.api` with `CancellationError`. Calls
already removed by a flush are unaffected; no in-flight fetch is aborted.
The function is one-shot: only the first invocation clears the queue. Later
calls can still be queued and sent.

### `client.isolated<R>(fn: (api, cancel) => R): R`

Creates an API with a separate queue and cancellation function. Calls `fn`
synchronously and returns its exact result. The API shares the client's
methods, session, authentication, hooks, and middleware.

`cancel()` has the same pending-only, one-shot behaviour as `cancelBatch()` and
affects only the isolated queue. Callback return or failure does not cancel
work automatically. See [batch control](../advanced/batching.md).

## Capability authoring

### `defineCapability({ urn, entities })`

Returns a descriptor builder preserving literal URI and entity types.
`urn` is a string; `entities` is a readonly array of entity names.

### `.withMethods<Methods, AccountDetails = unknown, SessionDetails = unknown>()`

Adds method and metadata types without runtime arguments. The descriptor
contains `urn` and `entities`; it does not contain method implementations.
The [extension guide](../advanced/extending.md) gives a complete example, and the
[type reference](./types.md#capability-authoring) describes the generic contracts.
