---
"json-meta-client": minor
---

Accept `AbortSignal` options for API calls and blob operations. Canceled
promises reject promptly and preserve the abort reason. Before sending, omit
canceled calls and their dependents; after sending, abort a shared HTTP request
only when every call in it is canceled.
