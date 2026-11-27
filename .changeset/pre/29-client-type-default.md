---
"json-meta-client": minor
---

`JsonMetaClient`'s second type parameter now has a default, so a client
type can be named by its capabilities alone, for example in a function
parameter:

```ts
function summarize(client: JsonMetaClient<["mail"]>) {}
```
