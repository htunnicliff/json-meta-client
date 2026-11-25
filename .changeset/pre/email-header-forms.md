---
"json-meta-client": minor
---

`header:` properties on `Email` and its body parts are now typed by their
parsed form (RFC 8621 section 4.1.2) instead of `unknown`. Requesting
`"header:To:asAddresses"` in `Email/get` `properties` (or `bodyProperties`)
types the result as `EmailAddress[] | null`, `"header:Subject:asText:all"` as
`string[]`, and a header without a form, such as `"header:X-Spam"`, as
`string | null`. Creating an `Email` checks each header value against its
form. The new `EmailHeaderForms` and `EmailHeaderValue` types are exported
from `json-meta-client/rfc-types`.
