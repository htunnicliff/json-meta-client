---
"json-meta-client": major
---

**Breaking:** method types are stricter.

- Arguments reject properties the method doesn't declare, at any depth:
  at the top level, in `/set` `create` and `update` entries, and in filter
  conditions inside `AND`, `OR`, and `NOT`. In 0.14, TypeScript let a
  misspelled property, a server-set property, or a filter condition from a
  capability the client doesn't configure through. Methods that leave their
  arguments open, such as `Core/echo`, are not checked.
- `Blob`, `ContactCard`, `AddressBook`, and `SieveScript` methods now check
  their arguments and type their responses.
- The types now follow the RFCs more closely. For example, the session's
  core limits are required, email address names can be `null`, and creating
  an `Email` requires `mailboxIds`.

The types are now part of the package instead of the `jmap-rfc-types`
dependency. To import them, use the new `json-meta-client/rfc-types` entry
point.
