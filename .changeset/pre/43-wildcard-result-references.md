---
"json-meta-client": patch
---

`resultRef()` now flattens arrays collected by a `*` wildcard, as RFC 8620
§3.7 specifies. On a `Thread/get` call, `resultRef("/list/*/emailIds")` is
typed `Ref<string[]>` instead of `Ref<string[][]>`, so it can be passed as
`ids` to `Email/get`.
