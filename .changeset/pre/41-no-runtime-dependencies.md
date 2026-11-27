---
"json-meta-client": patch
---

The package no longer has runtime dependencies. The types that came from
`jmap-rfc-types` and `type-fest` are now part of the library, and the client
reads the event stream without `eventsource-client`.
