# Capabilities

## What a capability is

:::warning TODO
- A URN plus a set of entities; adds typed methods to `client.api`
:::

## Enabling capabilities

:::warning TODO
- Built-in names as strings: `"mail"`, `"submission"`, `"blob"`, `"contacts"`,
  `"sieve"`, `"vacationResponse"`, `"community:maskedEmail"`; `core` is always on
- Names are case-sensitive; unknown names fail at the type level and throw
  `CapabilityConfigurationError` at runtime
- Names can be mixed with `defineCapability` objects (link to Extending)
- Built-in capability objects are NOT exported; never show `import { mail }`
:::

## The `using` array

:::warning TODO
- Each request includes `core` plus URNs of entities used by the batch's calls
- An entity in several capabilities includes all their URNs (e.g. `Blob` in `core` and `blob`)
- URNs are never duplicated
:::

## Checking server support

:::warning TODO
- On first session load, configured URNs missing from `session.capabilities`
  produce a `console.warn` with a `ConfigurationError`; this does not throw
:::

## Reading capability details

:::warning TODO
- `session.capabilities[urn]` (server-wide) and
  `session.accounts[id].accountCapabilities[urn]` (per account) are typed per configured capability
- Both are `Partial`: check for `undefined` before reading (this page is where
  AGENTS.md allows showing the check)
- Example: `maxSizeUpload` from core, `maxMailboxDepth` from mail
:::

## Community capabilities

:::warning TODO
- What the `community:` prefix means
- `MaskedEmail` (`https://www.fastmail.com/dev/maskedemail`) (`get`/`set`, fields and states)
:::
