---
"json-meta-client": minor
---

Method arguments are now optional when a method has no required arguments
once the client fills in `accountId`. `client.api.Mailbox.get()` is the same
as `client.api.Mailbox.get({})`. Methods with required arguments, such as
`Email/parse` or `Blob/copy`, still need them. To pass options without
arguments, give `undefined` as the arguments.

`Parameters<typeof client.api.Mailbox.get>[0]` now includes `undefined` for
such methods.
