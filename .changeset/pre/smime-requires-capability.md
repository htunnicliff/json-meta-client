---
"json-meta-client": major
---

**Breaking:** S/MIME types now need the `smime` capability. A client
configured with `["mail"]` no longer accepts the `smime*` properties in
`Email/get` or the `hasSmime` and `hasVerifiedSmime` filter conditions in
`Email/query`, `Email/queryChanges` and `SearchSnippet/get`. Configure
`["mail", "smime"]` to use them. Configuring `smime` without `mail` now throws
`CapabilityConfigurationError`, and `SearchSnippet` calls on an S/MIME client
also send `urn:ietf:params:jmap:smimeverify`.
