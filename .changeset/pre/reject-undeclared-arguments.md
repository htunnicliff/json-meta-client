---
"json-meta-client": major
---

**Breaking:** method arguments now reject properties that the method doesn't
declare, at any depth: in `/set` `create` and `update` entries, in filter
conditions inside `AND`, `OR` and `NOT`, and at the top level. A misspelled
property, a server-set property, or a filter condition from a capability the
client doesn't configure previously compiled, because TypeScript skips its
excess property check for inferred arguments. Arguments that a method leaves
open, such as `Core/echo`, and result references are not checked.
