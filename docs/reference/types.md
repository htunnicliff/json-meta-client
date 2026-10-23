# Types

Import public types from `json-meta-client`. Most application code can let TypeScript infer method arguments, responses, and references from the configured client.

## Configuration and hooks

```ts
import type {
  AfterResponseHook,
  BeforeRequestHook,
  BuiltInCapabilityName,
  CapabilityOption,
  Config,
} from "json-meta-client";
```

| Export                  | Purpose                                                                   |
| ----------------------- | ------------------------------------------------------------------------- |
| `Config<Capabilities>`  | Constructor configuration for a readonly capability array type            |
| `BuiltInCapabilityName` | Supported built-in names, such as `"mail"`                                |
| `CapabilityOption`      | A built-in name or a capability definition                                |
| `BeforeRequestHook`     | Receives `{ request }`; returns a request or a promise for one            |
| `AfterResponseHook`     | Receives `{ request, response }`; returns a response or a promise for one |

For a reusable configuration, preserve the capability names as literals so the client retains their method types:

```ts
const options = {
  sessionUrl: "https://your-provider.example/.well-known/jmap",
  bearerToken: "<bearer-token>",
  capabilities: ["mail"] as const,
};

const client = new JsonMetaClient(options);
```

`DEFAULT_CAPABILITIES` is a value export containing the core definition. Import it without `type` when you want to inspect the value.

## Capability contracts

```ts
import type { Capability, InferMethodsFromCapability, MethodContract } from "json-meta-client";
```

`Capability<Entity, Methods, Urn>` carries the definition's entity names, method contracts, and identifier. `MethodContract` defines `input` and `output`, while `InferMethodsFromCapability<C>` retrieves a definition's method map.

See [Capability API](./capability-api.md) for a complete custom definition and an output type that depends on input properties.

## Response inference

Built-in contracts can narrow returned records to match the requested properties:

```ts
const result = await client.api.Email.get({
  ids: ["<email-id>"],
  properties: ["subject", "receivedAt"],
});

for (const message of result.list) {
  console.log(message.subject, message.receivedAt);
}
```

If you store a property selection separately, preserve its literals with `as const`. A widened array can lose the information the contract needs for precise output inference.

Result references carry the type selected by their pointer, so a reference to a query's `/ids` can be used where an ID array is expected. Internal helpers such as `Ref`, `ClientApi`, and `Middleware` are not package-root exports; prefer the inferred values instead of importing internal paths.

These are compile-time guarantees. They do not check actual server payloads, and some built-in extensions use `any`. See [Capabilities](../features/capabilities.md) for the current coverage.

## Event types

```ts
import type { OnStateChangeOptions, StateChangePayload } from "json-meta-client";
```

`OnStateChangeOptions` contains `pingSeconds?: number` and `signal?: AbortSignal`.

`StateChangePayload` contains the strings `accountId`, `entity`, and `state`, plus `isPrimaryAccount: boolean`. The primary-account flag refers to the session's primary mail account. See [Events](../features/events.md) before using state tokens for synchronization.

## Protocol types

The underlying protocol types, including `Session` and `BlobUploadResponse`, come from [`jmap-rfc-types`](https://www.npmjs.com/package/jmap-rfc-types). Add that package as a direct dependency when importing its types in your application.
