---
"json-meta-client": patch
---

Reject pending method calls when batch processing fails instead of leaving
their promises unresolved. Document and test when calls share a batch and how
failures affect other calls.
