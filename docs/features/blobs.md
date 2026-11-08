# Blobs

## Uploading

:::warning TODO
- `client.blob.upload(body: BodyInit, { accountId? })` returns `{ accountId, blobId, type, size }`
- Content-Type comes from the body (a `Blob`'s `type`); default account is the primary mail account
:::

## Downloading

:::warning TODO
- `client.blob.download({ blobId, type, name, accountId? })` returns the raw `Response`
  (stream it or call `.blob()`)
- A failed download throws `HttpError`
:::

## Using blobs in method calls

:::warning TODO
- Attachments in `Email/set`, plus `Email/import` and `Email/parse`
- Cross-link to the attachment examples
:::

## Copying between accounts

:::warning TODO
- `Blob.copy` (from core)
:::

## Blob management (RFC 9404)

:::warning TODO
- With the `blob` capability: `Blob.upload` (inline data sources), `Blob.get`
  (ranges, digests), `Blob.lookup`
:::

## Errors

:::warning TODO
- `InvalidUriTemplateError` when the server's URL template lacks a parameter
- Upload too large gives `HttpError` (413)
:::
