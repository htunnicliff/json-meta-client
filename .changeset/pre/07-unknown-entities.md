---
"json-meta-client": major
---

**Breaking:** a method call on an entity that no configured capability
declares, such as `client.api.Foo.bar()`, now rejects with
`UnknownEntityError` and is never sent. In 0.14, it was sent without a
capability URN in `using`.

Add a built-in capability that declares the entity, or declare it with
`defineCapability`. `Core`, `Blob`, and `PushSubscription` stay callable
without listing `core`.
