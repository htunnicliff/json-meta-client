---
"json-meta-client": minor
---

Support AbortSignal options for individual JMAP calls and blob operations. Cancel promises promptly, preserve abort reasons, omit pending canceled dependencies, and abort shared transport only when every associated call is canceled.
