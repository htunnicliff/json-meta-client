---
"json-meta-client": minor
---

Add built-in capabilities for more JMAP extensions:

- `quota` (RFC 9425): `Quota` methods.
- `sharing` (RFC 9670): `Principal` and `ShareNotification` methods.
- `mdn` (RFC 9007): `MDN/send` and `MDN/parse`.
- `smime` (RFC 9219): the S/MIME properties and filters on `Email`. Use it
  with `mail`.

A capability can list other URNs its methods need with the new `dependsOn`
option, including in `defineCapability()`. The client adds them to `using`
whenever one of the capability's entities is called.
