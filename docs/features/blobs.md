# Blobs

A blob is a stored sequence of bytes. Use `client.blob` to upload or download those bytes through the URLs advertised in the session.

These helpers make their own HTTP requests. They do not join API method batches and are separate from the methods on `client.api.Blob`.

## Upload bytes

```ts
const upload = await client.blob.upload(new Blob(["Meeting notes"], { type: "text/plain" }));

console.log(upload.accountId, upload.blobId, upload.type, upload.size);
```

The body accepts Fetch's `BodyInit` values, including strings, byte arrays, and `Blob` objects. Giving a `Blob` a MIME type lets Fetch supply its content type.

The response is the server's upload metadata. Save the blob ID if a subsequent JMAP method will use the content. An upload alone does not create an email, attachment record, or other application record.

To upload into a particular account, pass `{ accountId: "<account-id>" }` as the second argument.

## Download bytes

Using the metadata from the upload above:

```ts
const response = await client.blob.download({
  accountId: upload.accountId,
  blobId: upload.blobId,
  name: "meeting-notes.txt",
  type: upload.type,
});

const contents = await response.text();
console.log(contents);
```

The return value is a standard `Response`. Choose `.text()`, `.blob()`, or `.arrayBuffer()` for the content you expect. Reading the body consumes it; clone the response first if you need a second reader.

`name` and `type` are download URL parameters. They describe the download and do not modify the stored bytes.

## Accounts, authentication, and URLs

Both helpers load the session when necessary. An omitted account ID uses its primary mail account; supply an explicit ID when the blob belongs elsewhere.

The client expands the session's `uploadUrl` or `downloadUrl`, attaches its bearer token, and runs the configured [HTTP hooks](./hooks.md). Each supplied template parameter must have a matching placeholder. A missing placeholder raises `InvalidUriTemplateError`.

## Handle failures

An unsuccessful HTTP status produces `HttpError`, while failures sending the request produce `NetworkError`. Uploads also parse the server's JSON metadata. Downloads leave body consumption to you, so handle errors from the body-reading method as well as from `download()` itself.

See [Errors](../reference/errors.md) for guards and diagnostic fields.
