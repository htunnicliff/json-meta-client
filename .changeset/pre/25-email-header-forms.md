---
"json-meta-client": minor
---

`header:` properties on `Email` and its body parts are now typed by their
parsed form (RFC 8621 §4.1.2) instead of `unknown`:

| Property                    | Type                     |
| --------------------------- | ------------------------ |
| `header:To:asAddresses`     | `EmailAddress[] \| null` |
| `header:Subject:asText:all` | `string[]`               |
| `header:X-Spam`             | `string \| null`         |

Creating an `Email` checks each header value against its form. The
`EmailHeaderForms` and `EmailHeaderValue` types are exported from
`json-meta-client/rfc-types`.
