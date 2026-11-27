---
"json-meta-client": major
---

**Breaking:** S/MIME types now need the new `smime` capability. With only
`"mail"`, `Email/get` no longer accepts the `smime*` properties, and
`Email/query`, `Email/queryChanges`, and `SearchSnippet/get` no longer
accept the `hasSmime` and `hasVerifiedSmime` filter conditions.

```ts
capabilities: ["mail", "smime"],
```

With `smime`, `Email` and `SearchSnippet` calls also send
`urn:ietf:params:jmap:smimeverify`. Configuring `smime` without `mail`
throws `CapabilityConfigurationError`.
