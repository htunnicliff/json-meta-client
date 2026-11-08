# Types

:::note TODO
These docs haven't been written yet but will be added soon.
:::

## Configuration types

- [ ] `Config`, `Auth`, `AuthCallback`

## Hook types

- [ ] `BeforeFetchHook`, `AfterFetchHook`, `BeforeJmapRequestHook`,
      `AfterJmapResponseHook`, `BeforeEventSourceConnectHook`, `AfterEventSourceConnectHook`

## Capability types

- [ ] `Capability`, `MethodContract`, `CapabilityOption`, `ResolveCapability`, `InferMethodsFromCapability`

## Client types

- [ ] `ClientApi<Caps>`, `ClientSession<Caps>`; how to type a helper that takes a client or session

## Event types

- [ ] `StateChangePayload`, `OnStateChangeHandler`, `OnStateChangeOptions`

## RFC data types

- [ ] How to get `Email`, `Mailbox`, etc. today (e.g. `Awaited<ReturnType<...>>`)
- [ ] Blocked: RFC types (and `Middleware`, `Ref`, `ConfigurableCapability`,
      `CapabilityMethods`) are not exported from the package entry point yet
