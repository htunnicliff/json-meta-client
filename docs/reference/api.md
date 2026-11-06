<!-- cspell:words behaviour -->

# API

All public imports use `"json-meta-client"`. The package exports `JsonMetaClient`, capability-authoring APIs, configuration/client/hook/state-change types, error classes, and their guards. [Types](/reference/types) and [Errors](/reference/errors) account for those exports. Built-in descriptor symbols, RFC modules, pending-call classes, and transport internals are not exported package entry points.

## `new JsonMetaClient(options)`

Creates a client synchronously without fetching a session. The capability tuple infers the API and session metadata; Core methods are always included. Invalid authentication, URL, capability configuration, or middleware throws a configuration error synchronously. The instance is frozen after construction.

| Option                           | Contract and default                                                                                                                                                                                                                   |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sessionUrl`                     | Required `string \| URL`; must parse as a URL. JMAP session discovery endpoint.                                                                                                                                                        |
| `auth`                           | Required [`Auth`](/reference/types#authentication-and-hooks): non-empty bearer `token`, Basic `username` and `password`, or an async-capable callback. Basic usernames must be non-empty and contain no colon; passwords may be empty. |
| `capabilities`                   | Required readonly array of built-in keys or custom descriptors. `[]` retains Core. See [selection and account support](/features/capabilities).                                                                                        |
| `hooks.beforeFetch`              | Optional readonly array; defaults to `[]`. Runs sequentially after authentication; each hook returns the next `Request`.                                                                                                               |
| `hooks.afterFetch`               | Optional readonly array; defaults to `[]`. Runs sequentially after fetch; each hook returns the next `Response`, before status checking or body parsing.                                                                               |
| `hooks.beforeJmapRequest`        | Optional readonly array; defaults to `[]`. Runs after middleware and session resolution, before serialisation; each hook returns the next JMAP request envelope.                                                                       |
| `hooks.afterJmapResponse`        | Optional readonly array; defaults to `[]`. Runs after HTTP validation/JSON parsing, before matching method responses; each hook returns the next JMAP response envelope.                                                               |
| `hooks.beforeEventSourceConnect` | Optional readonly array; defaults to `[]`. Runs after `beforeFetch` on every connection/reconnect; each hook returns the next `Request`.                                                                                               |
| `hooks.afterEventSourceConnect`  | Optional readonly array; defaults to `[]`. Runs after `afterFetch` and stream validation, before reading messages; observers return `void` or `Promise<void>`.                                                                         |
| `middleware`                     | Optional readonly array of synchronous JSON argument transformations; defaults to `[]`. Unstable. Runs after built-in reference replacement and mail-account injection. See [Hooks](/advanced/hooks).                                  |

Authentication and HTTP hooks apply to session, API, blob, and event-stream requests, including reconnects. [Authentication](/features/authentication) covers credential setup; [Hooks](/advanced/hooks) owns lifecycle and migration guidance.

## `client.api`

A readonly typed proxy for configured methods plus Core. Each method has the effective signature `method(args, options?)`, where `args` follows the method's capability contract and `options` is `{ id?: string }`. A missing ID becomes a generated string beginning with the method name. Give distinct IDs to calls in a request. Methods enqueue synchronously and return an augmented `Promise<Output>`; the queue flushes in the next microtask. See [Method Calls](/features/method-calls) and [Batching](/advanced/batching).

Arguments with a protocol `accountId` may omit it; the client supplies `session.primaryAccounts["urn:ietf:params:jmap:mail"]`. Pass an explicit account for other capabilities and shared accounts. Result-property selection and typed references can change `Output`. Results are method argument objects, without the enclosing JMAP response envelope.

| Pending call member        | Contract                                                                                                                                                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `then`, `catch`, `finally` | Standard promise operations; awaiting yields the method result.                                                                                                                                                |
| `$id`                      | Readonly invocation ID string.                                                                                                                                                                                 |
| `$method`                  | Readonly method name string, such as `Email/get`.                                                                                                                                                              |
| `$args`                    | Readonly property exposing the transformed argument object; it is not a deep-frozen snapshot.                                                                                                                  |
| `resultRef(pointer)`       | Returns a reference carrying `{ resultOf, name, path }` and a phantom value type. A typed JSON Pointer selects a compatible result value, including `*` array traversal. It does not await or read a response. |
| `createdRef(id)`           | Available on `/set` calls; returns `#${id}` for a key in that call's `create` object. Unknown IDs throw `RangeError` synchronously.                                                                            |

Reference producers and consumers must be queued in the same request in the correct order, as required by [RFC 8620 §3.7](https://www.rfc-editor.org/rfc/rfc8620.html#section-3.7). The client does not validate these relationships across queues or requests. Methods can throw synchronously if argument transformation fails or middleware returns a non-object; ordinary transport, HTTP, JMAP, response-correlation, and cancellation failures reject the pending promise. Per-object set errors resolve normally; see [Errors](/reference/errors).

## Session access

| Operation                 | Returns and behaviour                                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `client.session`          | `Promise<ClientSession<Capabilities>>`. Lazily fetches and caches the promise on first access; concurrent consumers share it. |
| `client.refreshSession()` | `Promise<ClientSession<Capabilities>>`. Always fetches and replaces the cached promise.                                       |

The first successful load warns about configured capabilities missing from the server. Session data is not schema-validated. A rejected session promise remains cached until `refreshSession()` replaces it. Loading and refreshing can reject with network/HTTP errors or JSON parsing failures. Refresh is explicit; method response session-state changes do not refresh automatically. See [Capabilities](/features/capabilities#check-support-and-choose-an-account).

## Blob helpers

These use the session's HTTP URL templates and do not require the `blob` capability key. Complete recipes and upload content-type details are in [Blobs](/features/blobs).

| Operation                               | Parameters and return                                                                                                                                                  |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `client.blob.upload(body, params = {})` | `body: BodyInit`; `params: { accountId?: string }`. POSTs the body and resolves to `{ accountId: string; blobId: string; type: string; size: number }`.                |
| `client.blob.download(params)`          | Required `{ blobId: string; type: string; name: string; accountId?: string }`. GETs the expanded URL and resolves to the fetched `Response`; read its body separately. |

Both default `accountId` to the primary mail account, load the session, and may reject for invalid URI-template parameters, network/HTTP errors, or session failures. Upload also parses JSON; download does not parse its response body. The helpers do not accept an abort signal or per-call request options.

## State-change subscriptions

`client.onStateChange(handler, options = {}): Promise<Disposable>` loads the session and opens an event stream for all types. `options` is `{ signal?: AbortSignal; pingSeconds?: number }`; ping defaults to `30` seconds and is rounded to an integer string for the URI template. The returned resource closes the stream through `[Symbol.dispose]()` (or the runtime's `disconnect` fallback). The supplied signal closes it on an abort event. See [Events](/features/events) for cleanup and callback usage.

`handler` receives either `(null, StateChangePayload)` once per account/entity update or `(StateChangeError, undefined)` for stream connection failures or message parsing/processing errors, including errors thrown by the success callback. `isPrimaryAccount` compares against the primary mail account. Initial setup can reject for session, template, or transport setup failures. The returned promise does not represent the lifetime of the stream. Later connection failures reach the handler with their underlying error as `cause`; intentional aborts do not report a connection failure. Dispose each subscription separately; batch cancellation does not close streams.

## Cancellation and isolation

`client.cancelBatch(): void` rejects calls still queued in `client.api` with `CancellationError`. It does not abort a request that has already flushed. Its abort controller fires once: calls enqueued after the first cancellation can run, and calling it again does not cancel them.

`client.isolated<R>(fn: (api, cancel) => R): R` creates a separate API queue and cancellation function, calls `fn` synchronously, and returns its exact result, including a promise. The isolated API has the same methods and shares the client's session, authentication, and hooks. Its `cancel()` affects only that queue and has the same one-shot/pending-only behaviour. It does not automatically cancel on callback return or throw. See [Batching](/advanced/batching) for complete examples.

## Capability authoring

`defineCapability({ urn, entities })` returns a descriptor builder. `.withMethods<Methods, AccountDetails = unknown, SessionDetails = unknown>()` supplies type contracts without runtime arguments or implementations. [Extending](/advanced/extending) owns the complete example; [Types](/reference/types#capability-authoring) lists the public authoring types.
