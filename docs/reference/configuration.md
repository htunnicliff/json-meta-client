# Configuration

The constructor accepts `Config<Capabilities>`, where `Capabilities` is the type of the readonly capability array.

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://your-provider.example/.well-known/jmap",
  bearerToken: "<bearer-token>",
  capabilities: ["mail"],
});
```

## Required fields

| Field          | Type                              | Requirements                                          |
| -------------- | --------------------------------- | ----------------------------------------------------- |
| `sessionUrl`   | `string \| URL`                   | A parseable absolute session URL                      |
| `bearerToken`  | `string`                          | A non-empty token, attached as bearer authorization   |
| `capabilities` | `ReadonlyArray<CapabilityOption>` | Built-in names, custom definitions, or an empty array |

Construction checks the token and URL shapes. Successful validation does not establish that the token is authorized or the endpoint is a working JMAP server; those checks happen through actual requests.

## Capability entries

Use a built-in name such as `"mail"`, or an object containing `urn: string` and `entities: ReadonlyArray<string>`. `defineCapability()` helps preserve literal names and attach method contracts to a custom definition.

Core types and the core request identifier are included automatically. An empty capability array is valid. See [Capabilities](../features/capabilities.md) for names and server-support behavior.

## `hooks`

An optional object with two optional arrays:

| Field           | Callback receives                          | Callback returns                  |
| --------------- | ------------------------------------------ | --------------------------------- |
| `beforeRequest` | `{ request: Request }`                     | `Request` or `Promise<Request>`   |
| `afterResponse` | `{ request: Request; response: Response }` | `Response` or `Promise<Response>` |

The arrays may be readonly. Their hooks run sequentially in the given order, passing each returned object to the next hook. These hooks cover session loading, method requests, and blobs; event streams use a separate connection.

See [Hooks](../features/hooks.md) for examples and error propagation.

## `middleware`

::: warning Unstable option
The middleware API may change. Use HTTP hooks when you need access to a request or response.
:::

An optional readonly array of synchronous functions, each taking and returning a JSON value. Middleware transforms method arguments when a call is created.

Transforms run in this order:

1. Rewrite result-reference argument keys.
2. Add a lazy `accountId` property when it is absent.
3. Run your supplied transforms in array order.

The session may not have loaded when middleware runs. Reading or spreading an object with an automatically injected account ID can evaluate that lazy property and throw. Load the session first if your transform needs to read the account ID.

## Defaults and validation errors

Method and blob account IDs default to the primary mail account. There is no automatic selection of an account based on the called entity's capability.

The constructor throws `ConfigurationError` for rejected configuration and `CapabilityConfigurationError` for unknown built-in names or invalid capability identifiers/entities. The latter includes the given capability and available built-in names. See [Errors](./errors.md).
