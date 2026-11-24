# Types

Every type on this page is exported from `json-meta-client` and can be
imported with `import type`. Most code never names them: the client infers
argument and result types from its configured capabilities.

## Configuration types

### `Config`

The options of [`new JsonMetaClient()`](./api.md#config). Its type parameter
is the `capabilities` array, which the constructor infers as a readonly tuple.

| Property               | Type                              | Description                                                       |
| ---------------------- | --------------------------------- | ----------------------------------------------------------------- |
| `sessionUrl`           | `string \| URL`                   | The JMAP session endpoint                                         |
| `auth`                 | `Auth`                            | How requests are authenticated                                    |
| `capabilities`         | `ReadonlyArray<CapabilityOption>` | Built-in capability names and custom capabilities                 |
| `generateMethodCallId` | `(method: string) => string`      | Optional. Generates a method call ID from a name like `Email/get` |
| `hooks`                | object of hook arrays             | Optional. Refer to [Hook types](#hook-types)                      |

### `Auth`

```ts
type Auth =
  | AuthCallback
  | string
  | { username: string; password: string };
```

A string is sent as a bearer token, and a username and password as Basic
credentials. Refer to [Authentication](./api.md#authentication).

### `AuthCallback`

```ts
type AuthCallback = (args: {
  request: Request;
}) => void | Promise<void>;
```

Receives each outgoing `Request` and changes it in place, such as by setting
its `Authorization` header. The client awaits it before running any
`beforeFetch` hook.

## Hook types

Each `hooks` option takes an array of these functions, which run in order.
Refer to [`hooks`](./api.md#hooks-optional) for when each one runs, and to the
[Hooks guide](../advanced/hooks.md).

### `BeforeFetchHook`

<<< ../../src/types.ts#hook-before-fetch

### `AfterFetchHook`

<<< ../../src/types.ts#hook-after-fetch

### `BeforeJmapRequestHook`

<<< ../../src/types.ts#hook-before-jmap-request

### `AfterJmapResponseHook`

<<< ../../src/types.ts#hook-after-jmap-response

### `BeforeEventSourceConnectHook`

<<< ../../src/types.ts#hook-before-event-source-connect

### `AfterEventSourceConnectHook`

<<< ../../src/types.ts#hook-after-event-source-connect

Typing a hook on its own lets you define it apart from the client:

```ts
import type { BeforeFetchHook } from "json-meta-client";

const addTraceHeader: BeforeFetchHook = ({
  httpRequest,
}) => {
  httpRequest.headers.set(
    "X-Trace-Id",
    crypto.randomUUID(),
  );
  return httpRequest;
};
```

## Capability types

### `Capability`

The object that [`defineCapability()`](./api.md#definecapability) returns.
At runtime it holds `urn`, `entities`, and the optional `dependsOn` and
`defaultAccount`. Its type parameters carry, in order, the entity names, the
method contracts, the URN, the account details, the session details, and the
default account setting.

### `MethodContract`

```ts
interface MethodContract {
  input: unknown;
  output: unknown;
}
```

Describes one method: the arguments it accepts and the response it resolves
with. A contract's `output` may read `this["input"]` to depend on the
arguments that were passed, which is how the built-in `/get` contracts narrow
their results to the requested `properties`. Refer to
[Method contracts](../advanced/extending.md#method-contracts).

### `DefaultAccount` and `DefaultAccountSetting`

```ts
type DefaultAccount = "primary" | null;
```

`DefaultAccountSetting` maps method names (`Entity/method`), or `"*"` for all
of a capability's methods, to a `DefaultAccount`. `"primary"` fills in the
session's primary account for the capability's URN; `null` leaves `accountId`
for the caller to pass. Refer to
[Default account](../advanced/extending.md#default-account).

### `CapabilityOption`

One entry of the `capabilities` option: `Capability | BuiltInCapabilityName`,
where `BuiltInCapabilityName` is the union of the
[built-in capability names](./capabilities.md#built-in), such as `"mail"`.

### `ResolveCapability`

`ResolveCapability<C>` turns a `CapabilityOption` into its `Capability`: a
built-in name becomes that built-in's type, and a custom capability stays as
it is.

### `InferMethodsFromCapability`

`InferMethodsFromCapability<C>` extracts a capability's method contracts,
keyed by entity and then by method name:

```ts
import {
  defineCapability,
  type InferMethodsFromCapability,
} from "json-meta-client";

const tasks = defineCapability({
  urn: "urn:example:tasks",
  entities: ["Task"],
}).withMethods<{
  Task: {
    get: {
      input: { ids: string[] };
      output: { list: { id: string }[] };
    };
  };
}>();

type TaskGetOutput = InferMethodsFromCapability<
  typeof tasks
>["Task"]["get"]["output"];
```

## Client types

### `ClientApi`

`ClientApi<Capabilities>` is the type of `client.api` for a list of
capability options: each entity, with each method typed from its contract.
`client.api` also includes the methods of `core`.

### `ClientSession`

`ClientSession<Capabilities>` is the type that [`.session`](./api.md#session)
resolves with: the RFC 8620 session, with `capabilities` and each account's
`accountCapabilities` typed for the configured capabilities. Both are
`Partial`, because a server may not support every configured capability.

### Typing a helper

To write a function that takes a client's API or session, name only the
capabilities it needs. A client configured with more capabilities can still
be passed:

```ts
import type {
  ClientApi,
  ClientSession,
} from "json-meta-client";

async function countMailboxes(
  api: ClientApi<["mail"]>,
): Promise<number> {
  const mailboxes = await api.Mailbox.get({ ids: null });
  return mailboxes.list.length;
}

function primaryMailAccount(
  session: ClientSession<["mail"]>,
): string | undefined {
  return session.primaryAccounts[
    "urn:ietf:params:jmap:mail"
  ];
}

console.log(
  await countMailboxes(client.api),
  primaryMailAccount(await client.session),
);
```

To accept the whole client, use the type of an existing one, such as
`typeof client`. `JsonMetaClient`'s second type parameter has no default, so
`JsonMetaClient<["mail"]>` alone is not a valid type.

## Event types

### `StateChangePayload`

One changed entity type in one account, passed to an
[`onStateChange()`](./api.md#onstatechange) handler.

| Property           | Type      | Description                                                               |
| ------------------ | --------- | ------------------------------------------------------------------------- |
| `accountId`        | `string`  | The account the change occurred in                                        |
| `entity`           | `string`  | The type that changed, such as `Email`                                    |
| `state`            | `string`  | The new state, to pass to the entity's `/changes` method                  |
| `isPrimaryAccount` | `boolean` | Whether an `Entity/get` call without `accountId` would go to this account |

`isPrimaryAccount` follows the same rules as the default `accountId` of method
calls. For a type with no `/get` method, such as `EmailDelivery`, it is `true`
when the account is the primary account of any configured capability, or the
session's only account. It is `false` when the default account is ambiguous.

### `OnStateChangeHandler`

```ts
import type {
  StateChangeError,
  StateChangePayload,
} from "json-meta-client";

type OnStateChangeHandler = (
  ...params:
    | [error: null, change: StateChangePayload]
    | [error: StateChangeError, change: undefined]
) => void;
```

Checking `error` narrows `change` to a `StateChangePayload`.

### `OnStateChangeOptions`

| Property      | Type          | Description                                                         |
| ------------- | ------------- | ------------------------------------------------------------------- |
| `signal`      | `AbortSignal` | Optional. Closes the connection when aborted                        |
| `pingSeconds` | `number`      | Optional. How often the server should send a ping. Defaults to `30` |

## JMAP Types

The types of the JMAP standards are exported from a separate, types-only
entry point, `json-meta-client/rfc-types`. It holds the objects, such as
`Mailbox`, `ReadableEmail` and `Session`, the capability details, and the
method helpers, such as `MethodGet` and `MethodSet`, that the built-in
capabilities are made from. JSContact (RFC 9553) types are under the
`JSContact` namespace, because some of their names are also JMAP type names.

```ts
import type {
  JSContact,
  Mailbox,
  ReadableEmail,
} from "json-meta-client/rfc-types";

function describe(
  mailbox: Mailbox,
  email: ReadableEmail,
  card: JSContact.Card,
) {
  console.log(mailbox.name, email.subject, card.name?.full);
}
```

`Request` and `Response` share their names with the Fetch globals, so rename
them when importing:

```ts
import type { Request as JmapRequest } from "json-meta-client/rfc-types";

const echo: JmapRequest = {
  using: ["urn:ietf:params:jmap:core"],
  methodCalls: [["Core/echo", { hello: true }, "c1"]],
};
```

To build contracts for a custom capability from these types, refer to
[Reusing RFC helper types](../advanced/extending.md#reusing-rfc-helper-types).

### Types of a result

A method's result can be narrower than the RFC object: a `/get` call that
passes `properties` lists only those properties. Derive the type from the
result itself:

```ts
const summaries = await client.api.Email.get({
  ids: null,
  properties: ["id", "subject", "receivedAt"],
});

type EmailSummary = (typeof summaries)["list"][number];
```

### Envelope types

The [JMAP hooks](#hook-types) receive these envelopes, also exported from
`json-meta-client/rfc-types`.

#### `JmapRequest`

<<< ../../src/rfc-types/core/rfc8620-jmap.ts#jmap-request

#### `Invocation`

<<< ../../src/rfc-types/core/rfc8620-jmap.ts#invocation

#### `JmapResponse`

<<< ../../src/rfc-types/core/rfc8620-jmap.ts#jmap-response
