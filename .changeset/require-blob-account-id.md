---
"json-meta-client": major
---

BREAKING: `accountId` is now required by the types on `client.blob.upload()`,
`client.blob.download()` and `Blob.copy`, and the client no longer fills it in.
Previously `blob.upload` and `blob.download` defaulted to the primary mail
account, which is missing on servers without mail. Pass the account that owns
the blob; for `Blob.copy` it is the destination account. `Email.copy` and
`ContactCard.copy` keep their optional `accountId`.
