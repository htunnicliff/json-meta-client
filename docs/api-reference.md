# Public API reference

Import `Client`, helpers, and public types from `json-meta-client`.
Standard presets live in `json-meta-client/capabilities`, and provider
extensions live in `json-meta-client/capabilities/community`.
See [supported package imports](package-api.md) for the complete export list.

## Client

`new Client(options)` creates a client whose method types come from
the configured capabilities, with Core methods always included. The
instance is frozen. Its options use `ClientOptions<Capabilities>`:

| Option         | Type and behavior                                                                |
| -------------- | -------------------------------------------------------------------------------- |
| `sessionUrl`   | Required URL string or `URL`; supplied by your service                           |
| `bearerToken`  | Required nonempty string; sent as bearer authentication                          |
| `capabilities` | Required readonly array of capability objects; `[]` selects core only            |
| `logger`       | Optional object with `error`, `warn`, `info`, and `debug`; defaults to `console` |
| `middleware`   | Optional readonly array of synchronous JSON transformations                      |

| Member                                 | Result and behavior                                                               |
| -------------------------------------- | --------------------------------------------------------------------------------- |
| `api.Entity.method(args, options?)`    | Pending method-call promise; await to receive that method's data                  |
| `session`                              | Cached promise for the session document, fetched lazily                           |
| `refreshSession()`                     | New session-fetch promise, replacing the cached promise                           |
| `blob.upload(body, params?, options?)` | Promise for blob upload metadata; upload account defaults to primary mail account |
| `blob.download(params, options?)`      | Promise for native `Response`; download account defaults to primary mail account  |
| `onStateChange(handler, options?)`     | Promise for a disposable event subscription                                       |

API methods return `PendingMethodCall<Input, Output>`, a promise with
`id`, `method`, and `args` metadata. Await it for the method result, use
`then`, `catch`, or `finally`, or pass it to `ref()` as a reference source.
Argument and result types follow the configured contracts; a `get`
property selection narrows its result. See [method contracts](method-contracts.md).

`MethodCallOptions` accepts `signal?: AbortSignal` for
[cancellation](cancellation.md). See [batching](batching.md) for when
requests are sent and [account selection](getting-started.md#choosing-an-account)
for the default `accountId`.

`StateChangePayload` contains `accountId: string`,
`isPrimaryAccount: boolean`, `entity: string`, and `state: string`.
`OnStateChangeOptions` accepts `pingSeconds?: number` and
`signal?: AbortSignal`. See [blobs and events](blobs-and-events.md).

## Capability authoring

`defineCapability({ urn, entities })` creates a `ConfigurableCapability`.
Call `.withMethods<Methods>()` to add method contracts and obtain a typed
`Capability`. Contracts describe argument and result types; they provide
no runtime method implementation. See [custom capabilities](custom-capabilities.md)
for fixed results and results that depend on arguments.

| Type                                   | Purpose                                                          |
| -------------------------------------- | ---------------------------------------------------------------- |
| `Capability<Entity, Methods, Urn>`     | Capability identifier, entity names, and method types            |
| `ConfigurableCapability<Entity, Urn>`  | Definition awaiting its method contracts                         |
| `CapabilityMethods<Entity>`            | Entity-to-method-to-contract map                                 |
| `MethodContract`                       | Method contract with `input` and `output`                        |
| `InferMethodsFromCapability<C>`        | Extracts a capability's carried method map                       |
| `MethodArguments<Contract>`            | Caller arguments with optional account ID and allowed references |
| `EffectiveMethodInput<Contract, Args>` | Input type after unwrapping references and supplying an account  |
| `Apply<Contract, Input>`               | Computes a contract's output for a concrete input                |

Literal capability values and property selections preserve the most
precise inference. Broad annotations or contracts using `any` lose
information. Type inference does not validate server responses.

## Result references

`ref(pendingCall, pointer)` creates a `Ref<SelectedValue>` with
`name`, `resultOf`, and `path`. Pass it as an argument so the server
can select a value from another call in the same request.
`AllowRefs<T>` permits references in arguments; `UnpackRefs<T>`
replaces them with their selected value types for inference. See
[result references](results-and-references.md) for paths and scope.

`Middleware` describes a synchronous JSON argument transformation.
`MethodCallContext` provides its optional `method: string` context,
using a name such as `Email/query`; see [middleware](middleware.md).

## Errors

Catch calls with `try`/`catch`, or use `Promise.allSettled` to observe
independent results. [Error classes](errors.md) provide categories and
context such as HTTP status and method IDs; use those fields to classify
failures.

`JmapError.isJmapError(value)` identifies a JMAP method error.
`JmapError.isProblemDetails(value)` checks the shape of a problem-details
payload. Inspect per-object errors inside resolved `set` responses
separately; they do not reject the method promise.
