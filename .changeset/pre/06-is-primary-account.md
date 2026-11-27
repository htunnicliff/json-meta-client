---
"json-meta-client": major
---

**Breaking:** `isPrimaryAccount` on a state change is now decided by the
changed entity. In 0.14, it was true only for the primary mail account.

It is now true when an `Entity/get` call for that entity, without an
`accountId`, would go to the changed account. With a primary mail account A
and a primary contacts account B:

| State change       | 0.14    | 1.0     |
| ------------------ | ------- | ------- |
| `Email` in A       | `true`  | `true`  |
| `ContactCard` in B | `false` | `true`  |
| `Email` in B       | `false` | `false` |
| `ContactCard` in A | `true`  | `false` |

For an entity with no such call, such as `EmailDelivery`, it is true when
the account is the primary account of any configured capability, or the
session's only account. `onStateChange` no longer needs a primary mail
account.
