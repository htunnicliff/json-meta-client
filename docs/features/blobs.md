# Blobs

Use `client.blob` to transfer raw data through the session’s upload and download URLs. These HTTP helpers are separate from `client.api.Blob` methods and do not enter method-call batches.

## Uploading

```ts
const uploaded = await client.blob.upload(new Blob(["Hello, JMAP!"], { type: "text/plain" }));

console.log(uploaded.blobId, uploaded.type, uploaded.size);
```

The body accepts a Fetch API `BodyInit`, such as a `Blob`, string, or byte array. A `Blob` with a type lets Fetch set the content type. The promise returns the server’s upload metadata, including `accountId`, `blobId`, `type`, and `size`.

To choose an account, pass `{ accountId: "<account-id>" }` as the second argument.

## Downloading

```ts
const response = await client.blob.download({
  blobId: uploaded.blobId,
  accountId: uploaded.accountId,
  name: "hello.txt",
  type: "text/plain",
});

const text = await response.text();
```

`download()` returns a Fetch API `Response`. Read it with `.text()`, `.blob()`, or `.arrayBuffer()` as appropriate. Response bodies can only be consumed once unless cloned first.

## Accounts and URLs

Both helpers load the session as needed and expand its URL templates. Without `accountId`, they use the primary mail account. Pass an explicit account when working with blobs elsewhere.

The `name` and `type` download parameters fill the server’s download URL template; they do not change the stored blob.

## Failures

Non-success HTTP responses reject with `HttpError`; fetch failures reject with `NetworkError`. A parameter without a matching URL-template placeholder produces `InvalidUriTemplateError`. See [Errors](../reference/errors.md).
