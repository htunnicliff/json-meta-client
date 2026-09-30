# Supported package imports

`json-meta-client` is an ESM package with four supported import paths.
Use these entry points for runtime values and types; source modules and
generated chunks are private.

| Import path                               | Purpose                                                                                                                |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `json-meta-client`                        | Client construction, custom capability contracts, result references, pending calls, middleware, and structured errors. |
| `json-meta-client/capabilities`           | Built-in standard capability presets.                                                                                  |
| `json-meta-client/capabilities/community` | Community extension presets and their entity/contract types.                                                           |
| `json-meta-client/package.json`           | Package metadata, imported with a JSON import attribute where required.                                                |

## Root runtime exports

The root exports `Client`, `defineCapability`, and `ref`, together with
`JmapClientError`, `JmapConfigurationError`, `JmapTransportError`, `JmapHttpError`,
`JmapProtocolError`, `JmapRequestLimitError`, `JmapAbortError`, `JmapError`, and
`JmapMethodError`. The last two names refer to the same constructor, named
`JmapError`. Class names are preserved in the minified distribution. Use
`instanceof` or error fields to classify failures; see [errors](errors.md).

## Root type exports

Import these names with `import type` or an inline `type` modifier. They
are TypeScript declarations and have no runtime values.

| Types                                                                                     | Purpose                                                                                        |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `ClientOptions<Capabilities>`                                                             | Client configuration, with a default generic for separately declared options.                  |
| `PendingMethodCall<Input, Output>`                                                        | A `Promise<Output>` with call metadata. Both type parameters default to `unknown`.             |
| `MethodCallOptions`                                                                       | Per-call transport options, including an abort signal.                                         |
| `Middleware`, `MethodCallContext`                                                         | Argument transformations with an optional context whose `method` is the full JMAP method name. |
| `StateChangePayload`, `OnStateChangeOptions`                                              | State-change event values and subscription options.                                            |
| `Capability`, `ConfigurableCapability`, `CapabilityMethods`, `InferMethodsFromCapability` | Capability registration and method contract extraction.                                        |
| `MethodContract`, `MethodArguments`, `EffectiveMethodInput`, `Apply`                      | Custom method inputs, caller arguments, effective inputs, and argument-dependent results.      |
| `Ref`, `AllowRefs`, `UnpackRefs`                                                          | Typed result references and recursive reference transformations.                               |
| `JmapRequestContext`, `JmapResponseContext`                                               | Request and response context carried by structured errors.                                     |

```ts
import {
  Client,
  type ClientOptions,
  type Middleware,
  type PendingMethodCall,
} from "json-meta-client";
import { mail } from "json-meta-client/capabilities";

const middleware: Middleware = (payload, context) => {
  console.debug(context?.method);
  return payload;
};

const options: ClientOptions<[typeof mail]> = {
  sessionUrl: "https://example.test/.well-known/jmap",
  bearerToken: "token",
  capabilities: [mail],
  middleware: [middleware],
};

const client = new Client(options);
const pending: PendingMethodCall = client.api.Mailbox.get({ properties: ["id"] });
```

The example declares options separately while preserving the mail capability
type. Its middleware receives the full method name as context. Existing
single-argument middleware still works; context is optional so functions can
also be called directly. See [middleware](middleware.md) for transformation
order and account injection, including the `Core/echo` exception and preservation
of `#accountId` references.

## Capability entry points

`json-meta-client/capabilities` exports `core`, `mail`, `blob`, `contacts`,
`sieve`, `submission`, and `vacationResponse`. See [capabilities](capabilities.md)
for their identifiers, entities, and typing coverage.

Protocol entity schemas generally come from `jmap-rfc-types`. The distribution
bundles declarations required by the client's public types, so consumers can use
strict Node or bundler module resolution without enabling imports of TypeScript
source files.

The built-in core capability exposes `Core.echo`, `Blob.copy`,
`PushSubscription.get`, and `PushSubscription.set`. `Core.echo` returns the
supplied arguments according to [RFC 8620 section 4](https://jmap.io/spec/rfc8620/#section-4).

`json-meta-client/capabilities/community` exports `maskedEmail` at runtime and
`MaskedEmail` and `MaskedEmailContracts` as types, so you can import both the
preset and its schemas from the supported entry point.

## Migrating existing imports

Root exports are now explicit. Update imports of `Config` to `ClientOptions`.
`DEFAULT_CAPABILITIES`, `isRef`, `Augment`, and `AugmentMethod` are private.
Core methods remain available on every client; use TypeScript completion on
`client.api` or import the `core` preset to inspect its declared types and
metadata. The proxy does not provide a runtime catalog of methods.

Replace calls to the former `Core.get` declaration with the appropriate
protocol method. JMAP Core defines no `Core/get`; `Core.echo` is available
for returning supplied arguments.

Use `PendingMethodCall` to describe pending calls and `Middleware` to type
argument transformations. `MethodCall`, `MethodCallResult`, `Batch`, `JobResult`,
and `Flush` remain internal, as do JSON Pointer and proxy helpers. A name appearing
inside generated declarations is not necessarily an exported package member.

## Package verification

From a repository checkout, run `pnpm test:package` to build and pack the
publishable package, then test it in an isolated consumer. The checks cover
Node runtime imports, strict Node and bundler TypeScript resolution, rejection
of private imports, runtime export lists, preserved error class names, and a
browser bundle. They also exercise `Core.echo` and account references through
the packed client. Fixtures reuse installed runtime dependencies, so these
checks require no package downloads.
