---
"json-meta-client": minor
---

Replace the external JMAP types dependency with the bundled standards types. Export JmapCore and JmapMail type namespaces, integrate typed Blob methods, and preserve get property projection and result references. Contacts, Sieve, and MaskedEmail use the shared generic contracts.

Core now exposes the standard echo method instead of get. Echo and PushSubscription calls omit automatic account injection, get projections include id, and Email address fields are nullable.
