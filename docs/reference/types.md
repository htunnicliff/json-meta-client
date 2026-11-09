# Types

## Configuration types

:::warning TODO
- `Config`, `Auth`, `AuthCallback`
:::

## Hook types

:::warning TODO
- `BeforeFetchHook`, `AfterFetchHook`, `BeforeJmapRequestHook`,
  `AfterJmapResponseHook`, `BeforeEventSourceConnectHook`, `AfterEventSourceConnectHook`
:::

## Capability types

:::warning TODO
- `Capability`, `MethodContract`, `CapabilityOption`, `ResolveCapability`, `InferMethodsFromCapability`
:::

## Client types

:::warning TODO
- `ClientApi<Caps>`, `ClientSession<Caps>`; how to type a helper that takes a client or session
:::

## Event types

:::warning TODO
- `StateChangePayload`, `OnStateChangeHandler`, `OnStateChangeOptions`
:::

## JMAP Types

:::warning TODO
- How to get `Email`, `Mailbox`, etc. today (e.g. `Awaited<ReturnType<...>>`)
- Blocked: RFC types (and `Ref`, `ConfigurableCapability`,
  `CapabilityMethods`) are not exported from the package entry point yet
:::

### `JmapRequest`

<<< ../../src/rfc-types/core/rfc8620-jmap.ts#jmap-request

### `Invocation`

<<< ../../src/rfc-types/core/rfc8620-jmap.ts#invocation

### `JmapResponse`

<<< ../../src/rfc-types/core/rfc8620-jmap.ts#jmap-response
