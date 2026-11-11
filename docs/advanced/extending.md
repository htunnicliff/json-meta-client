# Extending

## Defining a capability

:::warning TODO
- `defineCapability({ urn, entities }).withMethods<Methods, AccountCaps?, SessionCaps?>()`,
  then pass the object in `capabilities`
:::

## Depending on other URNs

:::warning TODO
- `defineCapability({ urn, entities, dependsOn })` lists other URNs that the
  server needs in `using` for this capability's methods
- The client adds them whenever one of the capability's entities is called
- Built-in example: `mdn` depends on the mail URN because `MDN/send` updates Emails
:::

## Method contracts

:::warning TODO
- `MethodContract` is `{ input, output }`
- Output can depend on input via `this["input"]` (show the `properties`-narrowing
  example from `custom-capabilities.test-d.ts`)
- A contract with `accountId` makes it optional at the call site
:::

## Untyped capabilities

:::warning TODO
- Omitting `withMethods` types allows any method name with `unknown` results
:::

## Session and account details

:::warning TODO
- The second and third generics type `session.capabilities[urn]` and `accountCapabilities[urn]`
:::

## Extending built-in URNs

:::warning TODO
- Define a vendor capability with the same URN (e.g. vendor `Email` methods under the mail URN)
- Contracts are intersected, not replaced
- Session details are merged (e.g. with `core`)
:::

## Sharing entities across capabilities

:::warning TODO
- Method types are intersected; the request includes every URN providing the entity
:::

## Reusing RFC helper types

:::warning TODO
- `MethodGet`, `MethodSet`, etc., as `masked-email.ts` does
- Blocked: RFC types are not exported from the package entry point yet
:::
