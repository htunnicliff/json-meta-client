---
"json-meta-client": minor
---

Method arguments are now optional when a method has no required arguments
once the client fills in `accountId`. `client.api.Mailbox.get()` is the same
as `client.api.Mailbox.get({})`. To pass options without arguments, give
`undefined` as the arguments.
