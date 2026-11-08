# Extending

## Defining a capability

:::note TODO
- `defineCapability({ urn, entities }).withMethods<Methods, AccountCaps?, SessionCaps?>()`,
  then pass the object in `capabilities`
:::

## Method contracts

:::note TODO
- `MethodContract` is `{ input, output }`
- Output can depend on input via `this["input"]` (show the `properties`-narrowing
  example from `custom-capabilities.test-d.ts`)
- A contract with `accountId` makes it optional at the call site
:::

## Untyped capabilities

:::note TODO
- Omitting `withMethods` types allows any method name with `unknown` results
:::

## Session and account details

:::note TODO
- The second and third generics type `session.capabilities[urn]` and `accountCapabilities[urn]`
:::

## Extending built-in URNs

:::note TODO
- Define a vendor capability with the same URN (e.g. vendor `Email` methods under the mail URN)
- Contracts are intersected, not replaced
- Session details are merged (e.g. with `core`)
:::

## Sharing entities across capabilities

:::note TODO
- Method types are intersected; the request includes every URN providing the entity
:::

## Reusing RFC helper types

:::note TODO
- `MethodGet`, `MethodSet`, etc., as `masked-email.ts` does
- Blocked: RFC types are not exported from the package entry point yet
:::
