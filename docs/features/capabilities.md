# Capabilities

:::note TODO
These docs haven't been written yet but will be added soon.
:::

## What a capability is

- [ ] A URN plus a set of entities; adds typed methods to `client.api`

## Enabling capabilities

- [ ] Built-in names as strings: `"mail"`, `"submission"`, `"blob"`, `"contacts"`,
      `"sieve"`, `"vacationResponse"`, `"community:maskedEmail"`; `core` is always on
- [ ] Names are case-sensitive; unknown names fail at the type level and throw
      `CapabilityConfigurationError` at runtime
- [ ] Names can be mixed with `defineCapability` objects (link to Extending)
- [ ] Built-in capability objects are NOT exported; never show `import { mail }`

## The `using` array

- [ ] Each request includes `core` plus URNs of entities used by the batch's calls
- [ ] An entity in several capabilities includes all their URNs (e.g. `Blob` in `core` and `blob`)
- [ ] URNs are never duplicated

## Checking server support

- [ ] On first session load, configured URNs missing from `session.capabilities`
      produce a `console.warn` with a `ConfigurationError`; this does not throw

## Reading capability details

- [ ] `session.capabilities[urn]` (server-wide) and
      `session.accounts[id].accountCapabilities[urn]` (per account) are typed per configured capability
- [ ] Both are `Partial`: check for `undefined` before reading (this page is where
      AGENTS.md allows showing the check)
- [ ] Example: `maxSizeUpload` from core, `maxMailboxDepth` from mail

## Community capabilities

- [ ] What the `community:` prefix means
- [ ] `MaskedEmail` (`https://www.fastmail.com/dev/maskedemail`) (`get`/`set`, fields and states)
