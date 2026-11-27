---
"json-meta-client": major
---

**Breaking:** `client.blob.upload()`, `client.blob.download()`, and
`Blob/copy` now require `accountId`. In 0.14, the blob transfers defaulted to
the primary mail account, but the right account depends on what the blob is
for.

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

For `Blob/copy`, `accountId` is the destination account. `Email/copy`,
`ContactCard/copy`, and the RFC 9404 `Blob/upload`, `Blob/get`, and
`Blob/lookup` methods still default it.
