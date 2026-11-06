---
"json-meta-client": minor
---

Use the built-in RFC types for all client and capability contracts.

Blob, Contacts, and Sieve methods now validate arguments and infer responses. Core exposes the RFC `echo` method. Session metadata and mail inputs now follow the built-in RFC contracts, including required core limits, nullable email address fields, and required mailbox IDs when creating emails.
