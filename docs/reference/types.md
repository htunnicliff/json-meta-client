# Types

The public entry point is `"json-meta-client"`. The inventory below covers all exported types. [API](/reference/api) covers runtime operations and [Errors](/reference/errors) covers classes and guards. Internal RFC modules, built-in descriptor symbols, and reference helper types have no public package subpath.

## Client types

| Export                                              | Contract                                                                                                                                                                                                   |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Config<T extends ReadonlyArray<CapabilityOption>>` | Required `auth`, `sessionUrl`, and `capabilities`; optional `hooks` and unstable `middleware`. Defaults and validation are in [API](/reference/api#new-jsonmetaclient-options).                            |
| `CapabilityOption`                                  | A built-in configuration key or a `Capability` descriptor. Exact keys are in the [catalogue](/reference/capabilities).                                                                                     |
| `ResolveCapability<C>`                              | Resolves a built-in string key to its descriptor type; leaves a custom descriptor unchanged.                                                                                                               |
| `ClientApi<T>`                                      | Intersects configured method contracts and adds promise/reference/metadata helpers. `T` is the capability tuple; Core is added separately by `JsonMetaClient`. `ClientApi<readonly []>` alone is `object`. |
| `ClientSession<T>`                                  | JMAP Session with optional typed server/account capability details for `T` plus Core. Details from contributions sharing a URI are intersected.                                                            |

Keep capability keys literal when storing configuration separately. A readonly tuple preserves which methods and metadata are available.

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
  session.capabilities["urn:ietf:params:jmap:sieve"];
if (sieve) console.log(sieve.implementation);

const accountId =
  session.primaryAccounts["urn:ietf:params:jmap:mail"];
if (!accountId)
  throw new Error("A primary mail account is required");
const result = await client.api.Email.get({
  accountId,
  ids: ["EMAIL_ID"],
  properties: ["id", "subject"] as const,
});
type SelectedEmail = (typeof result.list)[number];
const printEmail = (email: SelectedEmail) =>
  console.log(email.id, email.subject);
result.list.forEach(printEmail);
```

The result type follows selected `properties`; it does not include unselected fields. Extract domain types from configured call results with `Awaited` or `typeof`, rather than importing internal RFC files. [Method Calls](/features/method-calls) covers the selection rules and [Capabilities](/features/capabilities) covers metadata presence checks.

A session includes `capabilities`, `accounts`, `primaryAccounts`, `username`, `apiUrl`, `downloadUrl`, `uploadUrl`, `eventSourceUrl`, and `state`. Accounts include `name`, `isPersonal`, `isReadOnly`, and `accountCapabilities`. Unknown advertised capability keys remain accessible as optional objects; configured detail types do not guarantee that a key is present or that responses have been validated.

## Capability authoring

| Export                                                             | Contract                                                                                                                                                                         |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MethodContract`                                                   | `{ input: unknown; output: unknown }`. Extend it and reference `this["input"]` in `output` for argument-dependent inference.                                                     |
| `Capability<Entity, Methods, Urn, AccountDetails, SessionDetails>` | Runtime `{ urn: Urn; entities: ReadonlyArray<Entity> }` with phantom method and metadata types. Defaults are `string`, arbitrary entity methods, `string`, `unknown`, `unknown`. |
| `InferMethodsFromCapability<C>`                                    | Extracts the entity-to-method contract map from a descriptor; returns `never` when the type does not match a capability.                                                         |

`defineCapability` is the runtime builder described in [API](/reference/api#capability-authoring). Its returned builder's `.withMethods<Methods, AccountDetails, SessionDetails>()` preserves literal URIs/entities. The complete public-import example, compatible composition, untyped fallback, and runtime limitations are in [Extending](/advanced/extending).

## Authentication and hooks

| Export                         | Signature                                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `AuthCallback`                 | `(args: { request: Request }) => void \| Promise<void>`; mutates the outgoing request before hooks.                                        |
| `Auth`                         | `AuthCallback \| { token: string; username?: never; password?: never } \| { username: string; password: string; token?: never }`.          |
| `BeforeFetchHook`              | `(params: { request: Request }) => Request \| Promise<Request>`.                                                                           |
| `AfterFetchHook`               | `(params: { request: Request; response: Response }) => Response \| Promise<Response>`.                                                     |
| `BeforeJmapRequestHook`        | `(params: { request: JmapRequest }) => JmapRequest \| Promise<JmapRequest>`.                                                               |
| `AfterJmapResponseHook`        | `(params: { request: JmapRequest; response: JmapResponse }) => JmapResponse \| Promise<JmapResponse>`.                                     |
| `BeforeEventSourceConnectHook` | Alias of `BeforeFetchHook`; transforms each stream connection request after Fetch hooks.                                                   |
| `AfterEventSourceConnectHook`  | `(params: { request: Request; response: Response }) => void \| Promise<void>`; observes a validated connection without consuming its body. |

Transform hooks return the object passed to the next hook; `afterEventSourceConnect` observers return nothing. All arrays run sequentially and await asynchronous callbacks; defaults are empty arrays. `JmapRequest` and `JmapResponse` here name the RFC envelopes for explanation; these aliases are not public exports. Use `Parameters<BeforeJmapRequestHook>[0]["request"]` or the corresponding response hook to extract their types. No per-method result hook is exported by this version. See [Authentication](/features/authentication) and [Hooks](/advanced/hooks) for complete transport lifecycle guidance.

## State-change types

| Export                 | Contract                                                                                                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StateChangePayload`   | `{ accountId: string; isPrimaryAccount: boolean; entity: string; state: string }`. `state` is opaque and belongs to the changed account/entity; use it as that entity's changes cursor. |
| `OnStateChangeHandler` | `(...params: [error: null, change: StateChangePayload] \| [error: StateChangeError, change: undefined]) => void`. Narrow on the error argument. Async handler results are not awaited.  |
| `OnStateChangeOptions` | `{ signal?: AbortSignal; pingSeconds?: number }`; ping defaults to `30`.                                                                                                                |

`isPrimaryAccount` means the primary **mail** account. [Events](/features/events) covers subscriptions and cleanup; [API](/reference/api#state-change-subscriptions) states setup and callback failure contracts.
