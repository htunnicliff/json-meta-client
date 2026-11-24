---
"json-meta-client": minor
---

Add a `json-meta-client/rfc-types` entry point that exports the JMAP types the
built-in capabilities are made from, such as `MethodGet`, `MethodSet`,
`MethodQuery`, and the core, mail, contacts, and sharing entity types. Use
them to build method contracts for custom capabilities, for example
`MethodGet.Contract<Bookmark>`. The JSContact (RFC 9553) types are exported
under the `JSContact` namespace, since some of their names, such as
`EmailAddress`, are also JMAP type names. The entry point exports types only.
