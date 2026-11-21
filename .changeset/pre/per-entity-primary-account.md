---
"json-meta-client": major
---

**Breaking:** `isPrimaryAccount` on state changes is now decided per entity.
It used to be true only for the primary mail account, whatever had changed.

It is now true when an `Entity/get` call for the changed entity that passes
no `accountId` would go to that account, by the same rules as method calls.
With a primary mail account A and a primary contacts account B:

| State change       | Before  | Now     |
| ------------------ | ------- | ------- |
| `Email` in A       | `true`  | `true`  |
| `ContactCard` in B | `false` | `true`  |
| `Email` in B       | `false` | `false` |
| `ContactCard` in A | `true`  | `false` |

Some types have no such call to resolve, such as the push-only
`EmailDelivery`, or an entity whose `/get` method has no default account.
For those, `isPrimaryAccount` is true when the account is the primary
account of any configured capability, or is the session's only account.

`isPrimaryAccount` is `false` when several accounts could serve the entity
and the session names no primary account for it.

`onStateChange` no longer needs a primary mail account, so it reports
`isPrimaryAccount` correctly on a session with no mail capability.
