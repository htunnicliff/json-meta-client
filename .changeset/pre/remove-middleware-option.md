---
"json-meta-client": major
---

BREAKING: Remove the unstable `middleware` client option. Passing
`middleware` to `JsonMetaClient` is now a type error and the option is
ignored at runtime. The built-in argument transformations (result reference
keys and `accountId` injection) still run. To change outgoing method calls,
use a `beforeJmapRequest` hook, which receives the whole request envelope
including each call's arguments.
