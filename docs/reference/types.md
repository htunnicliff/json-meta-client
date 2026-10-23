# Types

## Public Imports

Import public types from the package root:

```ts
import type {
  AfterResponseHook,
  BeforeRequestHook,
  BuiltInCapabilityName,
  Capability,
  CapabilityOption,
  Config,
  InferMethodsFromCapability,
  MethodContract,
  OnStateChangeOptions,
  StateChangePayload,
} from "json-meta-client";
```

Internal helpers such as `Ref`, `ClientApi`, and `Middleware` are not public exports. Prefer inference for method promises and result references.

## Client Configuration

| Export                  | Purpose                                                  |
| ----------------------- | -------------------------------------------------------- |
| `Config<Capabilities>`  | Constructor options for a readonly capability array type |
| `BuiltInCapabilityName` | Union of built-in configuration names                    |
| `CapabilityOption`      | A built-in name or `Capability` definition               |
| `DEFAULT_CAPABILITIES`  | Runtime constant containing the core capability          |

`DEFAULT_CAPABILITIES` is a value export. Import it without `type` if you need to inspect it at runtime. See [Configuration](./configuration.md) for option details.

## Hook Types

`BeforeRequestHook` receives `{ request: Request }` and returns `Request | Promise<Request>`.

`AfterResponseHook` receives `{ request: Request; response: Response }` and returns `Response | Promise<Response>`.

See [Hooks](../features/hooks.md) for ordering, body handling, and error behavior.

## Capability Types

- `Capability<Entity, Methods, Urn>` describes a capability’s entity names, method contracts, and identifier.
- `MethodContract` has `input` and `output` members.
- `InferMethodsFromCapability<C>` extracts a definition’s method map.

See [Capability API](./capability-api.md) for custom definitions and argument-dependent outputs.

## Event Types

`StateChangePayload` contains `accountId`, `entity`, and `state` strings, plus the `isPrimaryAccount` boolean. Primary-account detection uses the session’s primary mail account.

`OnStateChangeOptions` accepts `pingSeconds?: number` and `signal?: AbortSignal`. See [Events](../features/events.md) for state-token semantics.

## Inferred Method Types

Built-in method contracts can derive their outputs from the supplied arguments. For example, selecting email properties narrows the records returned by `Email/get`:

```ts
const result = await client.api.Email.get({
  ids: ["<email-id>"],
  properties: ["subject", "from"],
});

for (const email of result.list) {
  console.log(email.subject, email.from);
}
```

Keep literal property selections when storing them in a variable, for example with `as const`. `.ref()` similarly infers the selected value from its response pointer.

Protocol types such as `Session` and `BlobUploadResponse` come from [`jmap-rfc-types`](https://www.npmjs.com/package/jmap-rfc-types). Add that package as a direct dependency if your application imports its types. Some built-in capabilities still use `any`; see [Capabilities](../features/capabilities.md).
