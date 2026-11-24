# Blobs

In JMAP, binary data such as attachments and raw messages lives in blobs.
Method calls refer to a blob by its `blobId`, and the data itself moves over
separate upload and download URLs that the session provides. The client
wraps those URLs in `client.blob`.

## Uploading

`client.blob.upload(body, { accountId })` uploads data to an account and
resolves to the new blob's details:

```ts
const session = await client.session;
const mailAccountId =
  session.primaryAccounts["urn:ietf:params:jmap:mail"]!;

const file = new Blob(["Quarterly numbers…"], {
  type: "text/plain",
});
const uploaded = await client.blob.upload(file, {
  accountId: mailAccountId,
});

console.log(uploaded.blobId, uploaded.type, uploaded.size);
```

The result has `accountId`, `blobId`, `type`, and `size`. The body can be
anything `fetch` accepts as a request body, such as a `Blob`, `File`,
`ArrayBuffer`, typed array, `ReadableStream`, or string. The `Content-Type`
of the upload comes from the body, so a `Blob` or `File` is uploaded with its
`type`.

`accountId` is required. A blob belongs to one account, and the right account
depends on what the blob is for: an attachment for an email goes to the mail
account, while a contact photo goes to the contacts account. The client
doesn't guess, so pass the account where the blob will be used.

## Downloading

`client.blob.download({ accountId, blobId, type, name })` resolves to the raw
`Response`, so you can stream it or read it however you need:

```ts
const response = await client.blob.download({
  accountId: mailAccountId,
  blobId: uploaded.blobId,
  type: "text/plain",
  name: "numbers.txt",
});

const text = await response.text();
// or: response.blob(), response.arrayBuffer(), response.body
```

`type` and `name` are filled into the session's download URL. Servers use
them for the `Content-Type` and file name of the download, which matters
most when the URL is handed to a browser.

A failed download, such as an unknown `blobId`, rejects with
[`HttpError`](../reference/errors.md).

## Using blobs in method calls

Once uploaded, a blob is used by ID in method calls on the same account:

- **`Email/set`** takes uploaded blobs as attachments, with a body part
  whose `blobId` is the upload's. See
  [Send an attachment](../examples.md#send-an-attachment).
- **`Email/import`** adds a raw RFC 5322 message, uploaded as a blob, to
  mailboxes as an email.
- **`Email/parse`** reads a message blob without importing it, such as an
  attached `message/rfc822` email.

Body parts returned by `Email/get` have a `blobId` too, so attachments can be
downloaded. See
[Get email attachments](../examples.md#get-email-attachments).

```ts
const raw = new Blob(
  [
    "From: someone@example.com\r\nSubject: Imported\r\n\r\nHello!\r\n",
  ],
  { type: "message/rfc822" },
);
const message = await client.blob.upload(raw, {
  accountId: mailAccountId,
});
const inboxId = (
  await client.api.Mailbox.query({
    filter: { role: "inbox" },
  })
).ids[0]!;

void client.api.Email.import({
  emails: {
    message: {
      blobId: message.blobId,
      mailboxIds: { [inboxId]: true },
    },
  },
});
```

## Copying between accounts

A blob ID is only valid in its own account. To use a blob in another
account, copy it with `Blob/copy`, which comes with `core` and is available
on every client:

```ts
const [, otherAccountId] = Object.keys(session.accounts);

void client.api.Blob.copy({
  fromAccountId: mailAccountId,
  accountId: otherAccountId!,
  blobIds: [uploaded.blobId],
});
```

`accountId` is the destination and is required. The client never fills it
in, since nothing in the call says where the copy should go.

## Blob management (RFC 9404)

The `"blob"` capability adds the methods of
[RFC 9404](https://www.rfc-editor.org/rfc/rfc9404), for servers that support
them:

- **`Blob/upload`** creates blobs inside a method call, from inline text,
  base64 data, or ranges of existing blobs, so small blobs need no separate
  upload request.
- **`Blob/get`** reads blob data as text or base64, optionally for a byte
  range with `offset` and `length`, and can return digests such as
  `digest:sha`.
- **`Blob/lookup`** finds the objects that refer to a blob, such as the
  emails that use it.

```ts
import { JsonMetaClient } from "json-meta-client";

const blobClient = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: "<token>",
  capabilities: ["mail", "blob"],
});

void blobClient.api.Blob.upload({
  create: {
    note: {
      data: [{ "data:asText": "Hello, world" }],
      type: "text/plain",
    },
  },
});

const [contents, usedBy] = await Promise.all([
  blobClient.api.Blob.get({
    // The blob that `Blob/upload` creates as "note"
    ids: ["#note"],
    properties: ["data:asText", "digest:sha", "size"],
  }),
  blobClient.api.Blob.lookup({
    typeNames: ["Email"],
    ids: [uploaded.blobId],
  }),
]);
```

`createdRef()` exists only on `/set` calls, so the `Blob/get` call above
refers to the new blob with its creation ID written out as `"#note"`. These
methods get a default `accountId` like other method calls; see
[Account IDs](./method-calls.md#account-ids).

## Errors

- If the session's upload or download URL template lacks a parameter the
  client needs to fill in, such as `{accountId}` or `{blobId}`, the call
  rejects with [`InvalidUriTemplateError`](../reference/errors.md) before any
  request is made.
- If the server refuses an upload, the call rejects with `HttpError`. An
  upload over the server's size limit typically answers with status `413`;
  the session's `maxSizeUpload` is that limit.

```ts
import { isHttpError } from "json-meta-client";

try {
  await client.blob.upload(file, {
    accountId: mailAccountId,
  });
} catch (error) {
  if (isHttpError(error) && error.status === 413) {
    console.error("That file is too large to upload");
  }
}
```
