# Configuration

Pass a configuration object to `new JsonMetaClient(options)`.

## Required Options

| Option         | Type                              | Description                                             |
| -------------- | --------------------------------- | ------------------------------------------------------- |
| `bearerToken`  | `string`                          | Non-empty bearer token sent in the authorization header |
| `sessionUrl`   | `string \| URL`                   | Absolute URL from which to retrieve the JMAP session    |
| `capabilities` | `ReadonlyArray<CapabilityOption>` | Built-in names and custom capability definitions        |

The constructor validates the token’s shape and whether the URL can be parsed. Authentication and server support are determined when requests run.

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  bearerToken: "<bearer-token>",
  sessionUrl: "https://your-provider.example/.well-known/jmap",
  capabilities: ["mail"],
});
```

## Capability Selection

Each entry may be a built-in capability name or an object with a string `urn` and an array of string `entities`. Use `defineCapability()` to author custom definitions and preserve their types.

An empty array is valid. Core API types and the core request URN are included automatically. See [Capabilities](../features/capabilities.md) for the built-in names and details of shared entities.

## Hooks

`hooks` accepts two optional arrays:

```ts
import type { Config } from "json-meta-client";

const hooks: Config<["mail"]>["hooks"] = {
  beforeRequest: [({ request }) => request],
  afterResponse: [({ response }) => response],
};
```

`beforeRequest` functions return `Request | Promise<Request>`. `afterResponse` functions receive both `request` and `response`, and return `Response | Promise<Response>`. Each array runs in order and is awaited. See [Hooks](../features/hooks.md) for scope and examples.

## Middleware

::: warning Unstable API
The `middleware` option may change. Prefer HTTP hooks for request and response customization.
:::

`middleware` is an optional array of synchronous JSON-value transforms. Each receives the method arguments and returns the arguments for the next transform.

Built-in transforms run first: nested result-reference rewriting, then lazy account ID injection. Your transforms run afterward in array order. They run when you create a call, before the session necessarily loads, so do not eagerly read an automatically injected `accountId` before loading the session.

## Validation and Defaults

Invalid constructor options throw `ConfigurationError`, with `CapabilityConfigurationError` for invalid capability definitions or unknown names. Capability support warnings occur on the first successful session load and do not throw.

The client defaults omitted method and blob account IDs to the primary mail account. It does not select an account based on the entity’s capability. Pass `accountId` explicitly when needed. See [Errors](./errors.md).
