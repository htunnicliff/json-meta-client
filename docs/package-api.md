# Supported package imports

`json-meta-client` is an ESM package. Its exports map defines four supported
import paths; source modules, generated chunks, and other import paths are private.

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
`JmapMethodError`. `JmapMethodError` is an alias of `JmapError`, so they share
constructor identity and the constructor name `JmapError`. Class names remain
intact in the minified distribution; prefer `instanceof` when classifying errors.

## Root type exports

These names are type-only imports. They do not appear in runtime module
namespaces.

| Types                                                                                     | Purpose                                                                                                       |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `ClientOptions<Capabilities>`                                                             | Client configuration, with a default generic for separately declared options.                                 |
| `PendingMethodCall<Input, Output>`                                                        | The pending method metadata intersected with `Promise<Output>`. Both generic parameters default to `unknown`. |
| `MethodCallOptions`                                                                       | Per-call transport options, including an abort signal.                                                        |
| `Middleware`, `MethodCallContext`                                                         | Argument transformations with an optional context whose `method` is the full JMAP method name.                |
| `StateChangePayload`, `OnStateChangeOptions`                                              | State-change event values and subscription options.                                                           |
| `Capability`, `ConfigurableCapability`, `CapabilityMethods`, `InferMethodsFromCapability` | Capability registration and method contract extraction.                                                       |
| `MethodContract`, `MethodArguments`, `EffectiveMethodInput`, `Apply`                      | Custom method inputs, caller arguments, effective inputs, and argument-dependent results.                     |
| `Ref`, `AllowRefs`, `UnpackRefs`                                                          | Typed result references and recursive reference transformations.                                              |
| `JmapRequestContext`, `JmapResponseContext`                                               | Request and response context carried by structured errors.                                                    |

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

Middleware receives the method context as its second argument. Existing
single-argument middleware functions continue to work. The context is optional
in the type so middleware can also be invoked directly without one. Built-in
middleware skips account injection for `Core/echo` and preserves an existing
`#accountId` result reference.

## Capability entry points

`json-meta-client/capabilities` exports the runtime presets `core`, `mail`,
`blob`, `contacts`, `sieve`, `submission`, and `vacationResponse`. Protocol entity
schemas generally come from `jmap-rfc-types`; the client distribution bundles
the protocol declarations needed by its own public types so ordinary consumers
can use strict Node or bundler module resolution without enabling source-file
TypeScript imports.

The built-in core capability exposes `Core.echo`, `Blob.copy`,
`PushSubscription.get`, and `PushSubscription.set`. `Core.echo` returns the
supplied arguments according to [RFC 8620 section 4](https://jmap.io/spec/rfc8620/#section-4).
The former `Core.get` declaration did not represent a defined core method and
has been removed.

`json-meta-client/capabilities/community` exports `maskedEmail` at runtime and
`MaskedEmail` and `MaskedEmailContracts` as types. Keeping the preset and its
extension schemas together avoids private module imports.

## Changes from the previous surface

Root wildcard exports have been replaced with explicit exports. `Config` is now
available as `ClientOptions`; `DEFAULT_CAPABILITIES`, `isRef`, `Augment`, and
`AugmentMethod` are private implementation details. Core methods remain available
on every client through the built-in default capability. Consumers can inspect
`client.api` or import `core` rather than depending on the implementation's
mutable default-capability list.

`MethodCall`, `MethodCallResult`, `Batch`, `JobResult`, and `Flush` remain internal.
Use `PendingMethodCall` for pending client values and `Middleware` for middleware
configuration. Internal JSON Pointer evaluation and proxy creation helpers are
also private. Generated declaration files may reference internal structural
names, but that does not make those names exported package members.

## Package verification

`pnpm test:package` builds and packs the real publish artifact, extracts it into
an isolated consumer, and verifies the supported runtime and type imports. The
suite checks Node resolution, strict Node and bundler TypeScript resolution,
private-path rejection, exact runtime export lists, class names in minified
output, and a browser-targeted bundle. It also exercises core echo arguments and
account references through the packed client. Fixtures use the installed runtime
dependencies without installing packages from the network.
