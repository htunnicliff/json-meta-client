---
"json-meta-client": patch
---

`resultRef` now flattens arrays collected by a `*` wildcard, as RFC 8620
section 3.7 specifies. `thread.resultRef("/list/*/emailIds")` on a
`Thread/get` call is typed `Ref<string[]>` instead of `Ref<string[][]>`, so
it can be passed as `ids` to `Email/get`. Pointers whose values are not
arrays, such as `/list/*/threadId`, are unchanged.
