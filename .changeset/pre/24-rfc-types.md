---
"json-meta-client": minor
---

Add the `json-meta-client/rfc-types` entry point. It exports the JMAP types
that the built-in capabilities are made from, such as `MethodGet`,
`MethodSet`, and `MethodQuery`, and the core, mail, contacts, and sharing
entity types. Use them to build method contracts for custom capabilities:

```ts
import type { MethodGet } from "json-meta-client/rfc-types";

type BookmarkGet = MethodGet.Contract<Bookmark>;
```

The JSContact (RFC 9553) types are under the `JSContact` namespace, because
some of their names, such as `EmailAddress`, are also JMAP type names. The
entry point exports only types.
