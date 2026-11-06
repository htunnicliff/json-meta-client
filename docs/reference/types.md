# Type reference

All types on this page are exported from `"json-meta-client"`. Most application
code can let the client infer its types from configuration and method arguments.
The named types are useful when sharing configuration, passing an API into an
application operation, or defining an extension.

Runtime operations are in the [API reference](./api.md). Error classes and their
type guards are in the [error reference](./errors.md). Internal RFC modules and
reference-helper types are not public package imports.

## Client types

| Export                                              | Meaning                                                                                                                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Config<T extends ReadonlyArray<CapabilityOption>>` | Constructor options for capability tuple `T`. Requires `auth`, `sessionUrl`, and `capabilities`; optionally includes `hooks` and unstable `middleware`. |
| `CapabilityOption`                                  | A built-in configuration key or a custom `Capability` descriptor.                                                                                       |
| `ResolveCapability<C>`                              | Resolves a built-in key to its descriptor type; leaves a custom descriptor unchanged.                                                                   |
| `ClientApi<T>`                                      | Combines methods from `T`, adding promises, references, and call metadata.                                                                              |
| `ClientSession<T>`                                  | A JMAP session with capability metadata types from `T` and Core.                                                                                        |

`JsonMetaClient` adds Core to its configured API separately. `ClientApi<T>` by
itself includes only `T`; `ClientApi<readonly []>` is `object`. This distinction
matters when using `ClientApi` as a function parameter.

A session contains `capabilities`, `accounts`, `primaryAccounts`, `username`,
`apiUrl`, `downloadUrl`, `uploadUrl`, `eventSourceUrl`, and `state`. Each account
has `name`, `isPersonal`, `isReadOnly`, and `accountCapabilities`.

Configured metadata remains optional because a server or account may not
advertise a capability. Contributions sharing a URI intersect their detail
types. Unknown advertised keys remain accessible as optional objects. None of
these types implies runtime schema validation.

### Preserve capability literals

A readonly tuple retains the selected capabilities when configuration is stored
in a variable. This example also extracts a domain type from a selected result:

```ts
import {
  JsonMetaClient,
  type CapabilityOption,
  type ClientSession,
  type Config,
} from "json-meta-client";

const options = {
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail", "sieve"],
} as const satisfies Config<readonly CapabilityOption[]>;

const client = new JsonMetaClient(options);
const session: ClientSession<typeof options.capabilities> =
  await client.session;
const sieve =
  session.capabilities["urn:ietf:params:jmap:sieve"]!;
console.log(sieve.implementation);

const result = await client.api.Email.get({
  ids: ["EMAIL_ID"],
  properties: ["id", "subject"],
});
type EmailSummary = (typeof result.list)[number];
const print = (email: EmailSummary) =>
  console.log(email.id, email.subject);
result.list.forEach(print);
```

`EmailSummary` contains the selected fields. `typeof` and `Awaited` can derive
application types from public call results without importing internal RFC files.
The [method call guide](../features/method-calls.md) covers selection and references.

## Capability authoring

| Export                                                             | Contract                                                                                                                         |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `MethodContract`                                                   | `{ input: unknown; output: unknown }`. An extending interface can use `this["input"]` to make output depend on actual arguments. |
| `Capability<Entity, Methods, Urn, AccountDetails, SessionDetails>` | A runtime descriptor with `urn: Urn` and `entities: ReadonlyArray<Entity>`, carrying method and metadata types.                  |
| `InferMethodsFromCapability<C>`                                    | Extracts the entity-to-method map from a capability, or returns `never` for a non-matching type.                                 |

`Capability` defaults to string entity and URI types, arbitrary entity methods,
and `unknown` account/session details. Its method and metadata parameters do
not add runtime fields.

The runtime `defineCapability()` builder preserves literal URIs and entities.
Its `.withMethods<Methods, AccountDetails, SessionDetails>()` method takes no
runtime arguments; both metadata parameters default to `unknown`. The
[extension guide](../advanced/extending.md) covers typed methods,
argument-dependent outputs, and untyped fallbacks.

## Authentication

| Export         | Signature or variants                                                            |
| -------------- | -------------------------------------------------------------------------------- |
| `AuthCallback` | `(args: { request: Request }) => void \| Promise<void>`                          |
| `Auth`         | `AuthCallback`, `{ token: string }`, or `{ username: string; password: string }` |

The object variants exclude fields from the other scheme with optional `never`
properties. The callback mutates the outgoing request and is awaited before
Fetch hooks. [Authentication](../features/authentication.md) covers credential
validation and refresh policy.

## Hooks

| Export                         | Signature                                                                                     |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| `BeforeFetchHook`              | `({ request: Request }) => Request \| Promise<Request>`                                       |
| `AfterFetchHook`               | `({ request: Request; response: Response }) => Response \| Promise<Response>`                 |
| `BeforeJmapRequestHook`        | `({ request: JmapRequest }) => JmapRequest \| Promise<JmapRequest>`                           |
| `AfterJmapResponseHook`        | `({ request: JmapRequest; response: JmapResponse }) => JmapResponse \| Promise<JmapResponse>` |
| `BeforeEventSourceConnectHook` | Alias of `BeforeFetchHook`.                                                                   |
| `AfterEventSourceConnectHook`  | `({ request: Request; response: Response }) => void \| Promise<void>`                         |

The signatures show each callback's single parameter object. `JmapRequest` and
`JmapResponse` are descriptive names here, not exported aliases. Their types can
be extracted from the hooks, for example with
`Parameters<BeforeJmapRequestHook>[0]["request"]`.

Transform hooks return the next object. `afterEventSourceConnect` observes a
validated connection and returns nothing. Arrays run sequentially, await
asynchronous callbacks, and default to empty. There is no exported per-method
result hook in this version. The [hook guide](../advanced/hooks.md) describes
the lifecycle and error boundaries.

## State-change types

| Export                 | Contract                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `StateChangePayload`   | `{ accountId: string; isPrimaryAccount: boolean; entity: string; state: string }`                                              |
| `OnStateChangeHandler` | Receives either `[error: null, change: StateChangePayload]` or `[error: StateChangeError, change: undefined]`; returns `void`. |
| `OnStateChangeOptions` | `{ signal?: AbortSignal; pingSeconds?: number }`; ping defaults to `30`.                                                       |

The payload's `state` is an opaque token for the changed account and entity.
`isPrimaryAccount` compares against the primary mail account. Narrowing the
handler's error argument also narrows its change argument. Asynchronous handler
results are not awaited. See [events](../features/events.md) for subscription
lifetimes and synchronisation.
