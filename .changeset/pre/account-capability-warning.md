---
"json-meta-client": patch
---

Stop warning about a configured capability when the server lists it only in
an account's `accountCapabilities`. The client now warns only when a URN is
missing from both the session's `capabilities` and every account's
`accountCapabilities`. Some servers, such as Stalwart with its
`urn:stalwart:jmap` management capability, advertise a capability only on the
accounts that can use it.
