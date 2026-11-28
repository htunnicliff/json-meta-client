---
"json-meta-client": patch
---

Let bundlers drop the built-in capabilities table from apps that don't construct a client. Importing only `patch`, `defineCapability`, or an error class no longer bundles every built-in capability.
