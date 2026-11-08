# Blobs

## Uploading

:::note TODO
- `client.blob.upload(body: BodyInit, { accountId? })` returns `{ accountId, blobId, type, size }`
- Content-Type comes from the body (a `Blob`'s `type`); default account is the primary mail account
:::

## Downloading

:::note TODO
- `client.blob.download({ blobId, type, name, accountId? })` returns the raw `Response`
  (stream it or call `.blob()`)
- A failed download throws `HttpError`
:::

## Using blobs in method calls

:::note TODO
- Attachments in `Email/set`, plus `Email/import` and `Email/parse`
- Cross-link to the attachment examples
:::

## Copying between accounts

:::note TODO
- `Blob.copy` (from core)
:::

## Blob management (RFC 9404)

:::note TODO
- With the `blob` capability: `Blob.upload` (inline data sources), `Blob.get`
  (ranges, digests), `Blob.lookup`
:::

## Errors

:::note TODO
- `InvalidUriTemplateError` when the server's URL template lacks a parameter
- Upload too large gives `HttpError` (413)
:::
