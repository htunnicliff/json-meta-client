---
"json-meta-client": minor
---

Derive result types from the caller's arguments through a single effective-input
type. Preserve custom `input`/`output` contracts, selected-property narrowing,
and nested result references. When an account ID is omitted, include its
contract type in pending call metadata and results that depend on arguments.
