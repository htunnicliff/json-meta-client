---
"json-meta-client": minor
---

`JsonMetaClient`'s second type parameter now has a default, so a client type
can be named by its capabilities alone. `JsonMetaClient<["mail"]>` is the type
of a client constructed with `capabilities: ["mail"]`, for example in a
function parameter.
