---
"json-meta-client": minor
---

Add an `onWarning` client option. It receives configured capabilities that
the server doesn't advertise, as a `ConfigurationError`, when the session
first loads. It defaults to `console.warn`, as before, so applications can
now send the warning to their own logger or silence it.
