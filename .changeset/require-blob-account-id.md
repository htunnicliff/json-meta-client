---
"json-meta-client": major
---

BREAKING: `client.blob.upload()`, `client.blob.download()`, and `Blob.copy`
now require `accountId`. The client no longer fills it in from the primary
mail account, because the right account depends on what the blob is for. On
a server with no primary mail account, the old default was missing at
runtime even though the types let callers omit it.

Pass the account explicitly:

```ts
await client.blob.upload(body, { accountId });
await client.blob.download({
  accountId,
  blobId,
  type,
  name,
});
await client.api.Blob.copy({
  fromAccountId,
  accountId,
  blobIds,
});
```

For `Blob.copy`, `accountId` is the destination account. `Email.copy` and
`ContactCard.copy` still default it, and so do the RFC 9404 `Blob.upload`,
`Blob.get`, and `Blob.lookup` methods.
