---
"json-meta-client": minor
---

Add built-in capabilities for JMAP extensions whose types were already
included:

- `quota` (RFC 9425): `Quota/get`, `changes`, `query`, and `queryChanges`
- `sharing` (RFC 9670): `Principal` and `ShareNotification` methods
- `mdn` (RFC 9007): `MDN/send` and `MDN/parse`
- `smime` (RFC 9219): adds `urn:ietf:params:jmap:smimeverify` to
  `Email` calls so servers return the `smime*` properties and accept the
  S/MIME filters. It adds no methods; enable `mail` alongside it.
