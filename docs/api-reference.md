# Public API reference

Import client APIs from `json-meta-client`, standard capabilities
from `json-meta-client/capabilities`, and provider extensions from
`json-meta-client/capabilities/community`. See the
[package API](package-api.md) for the published entry-point contract.
The following reference describes caller-facing behavior;
internal batching classes and URI-template helpers are not public
entry points.

## Client

`new Client(options)` infers available methods from the configured
capability array and always adds core methods. The instance is
frozen. `ClientOptions<Capabilities>` describes its options:

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

`PendingMethodCall<Input, Output>` describes the returned promise and its
argument metadata. Pending calls carry `id`, `method`, and `args` for
use with `ref()`. `MethodCallOptions` accepts `signal?: AbortSignal`
for per-operation cancellation; see [cancellation](cancellation.md).
They remain promises, with `then`, `catch`, and `finally`. Arguments
and response types come from your configured method contracts;
`get` response inference follows selected properties. See
[method contracts](method-contracts.md), [batching](batching.md), and
[account defaults](getting-started.md#calls-properties-and-accounts).

`StateChangePayload` contains `accountId: string`,
`isPrimaryAccount: boolean`, `entity: string`, and `state: string`.
`OnStateChangeOptions` accepts `pingSeconds?: number` and
`signal?: AbortSignal`. See [blobs and events](blobs-and-events.md).

## Capability authoring

`defineCapability({ urn, entities })` returns a
`ConfigurableCapability`, whose `withMethods<Methods>()` method
returns a configured `Capability`. The method contracts are
TypeScript data rather than runtime implementations.
[Custom capability authoring](custom-capabilities.md) explains
how to define fixed and argument-dependent results.

| Type                                   | Purpose                                                           |
| -------------------------------------- | ----------------------------------------------------------------- |
| `Capability<Entity, Methods, Urn>`     | Configured identifier/entities with a carried method map          |
| `ConfigurableCapability<Entity, Urn>`  | Definition awaiting its method contracts                          |
| `CapabilityMethods<Entity>`            | Entity-to-method-to-contract map                                  |
| `MethodContract`                       | Method contract with `input` and `output`                         |
| `InferMethodsFromCapability<C>`        | Extracts a capability's carried method map                        |
| `MethodArguments<Contract>`            | Caller arguments with optional account ID and allowed references  |
| `EffectiveMethodInput<Contract, Args>` | Conceptual input after reference unpacking and account completion |
| `Apply<Contract, Input>`               | Computes a contract's output for a concrete input                 |

These types do not validate wire responses. Literal capabilities
and property selections give the most precise inference; broad
annotations and permissive contracts lose information.

## Result references

`ref(pendingCall, pointer)` returns a `Ref<SelectedValue>` carrying
`name`, `resultOf`, and `path`. It is used as an argument value,
not as an awaited local result. `AllowRefs<T>` allows references in
argument positions, and `UnpackRefs<T>` derives the conceptual
values when computing response types. See
[result references](results-and-references.md) for paths and scope.

`Middleware` describes a synchronous JSON argument transformation.
`MethodCallContext` provides its optional `method: string` context,
using a name such as `Email/query`; see [middleware](middleware.md).

## Errors

The error classes and their context fields are documented in
[errors](errors.md). Catch method calls inside normal `try`/`catch`
blocks or observe independent calls with `Promise.allSettled`.
Do not infer HTTP status or protocol error categories by parsing
an error message.

`JmapError.isJmapError(value)` tests a JMAP method error.
`JmapError.isProblemDetails(value)` tests a problem-details payload;
it is a structural guard rather than proof that a server operation
succeeded. Raw per-object JMAP errors in a successful `set` response
must be checked in that response.
