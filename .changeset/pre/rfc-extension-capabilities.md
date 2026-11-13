---
"json-meta-client": minor
---

Add built-in capabilities for JMAP extensions whose types were already
included:

- `quota` (RFC 9425): `Quota/get`, `changes`, `query`, and `queryChanges`
- `sharing` (RFC 9670): `Principal` and `ShareNotification` methods
- `mdn` (RFC 9007): `MDN/send` and `MDN/parse`. Requests also include
  `urn:ietf:params:jmap:mail`, which RFC 9007 requires for `MDN/send`
- `smime` (RFC 9219): adds `urn:ietf:params:jmap:smimeverify` to
  `Email` calls so servers return the `smime*` properties and accept the
  S/MIME filters. It adds no methods; enable `mail` alongside it.

Capabilities can now list other URNs that their methods need in `using`
with an optional `dependsOn` array, including through
`defineCapability({ urn, entities, dependsOn })`. The client adds those URNs
whenever one of the capability's entities is called.
