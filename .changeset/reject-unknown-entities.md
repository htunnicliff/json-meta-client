---
"json-meta-client": major
---

BREAKING: Calling a method on an entity that no capability declares, such
as `client.api.Foo.bar({})`, now rejects with `UnknownEntityError` (a
`ConfigurationError`) and is never sent to the server. Previously the call
was sent without a capability URN in `using`. The error names the entity
and method; fix it by adding a capability that declares the entity, using a
built-in capability or `defineCapability`. `Core`, `Blob` and
`PushSubscription` stay callable without listing `core`. Callers that
relied on a `beforeJmapRequest` hook to add the URN for an undeclared
entity must declare the entity with `defineCapability` instead.
