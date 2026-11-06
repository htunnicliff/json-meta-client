# Blobs

The `client.blob` helpers transfer raw binary data over HTTP using
the session's upload/download URL templates. They work without
the optional `blob` capability. That capability enables JMAP
`Blob/*` method calls through `client.api.Blob`; it does not
configure these HTTP helpers. See
[RFC 8620 §6](https://www.rfc-editor.org/rfc/rfc8620.html#section-6).

Use [shared setup](../index.md) with a server account that permits
the transfer. Both helpers apply configured authentication and
[HTTP hooks](../advanced/hooks.md). They expand and encode the
server's URL templates; do not build attachment URLs yourself.

## Upload bytes with a media type

`upload(body, params?)` accepts the platform's `BodyInit`, including
`Blob`, `File`, strings, byte buffers, `URLSearchParams`, and
`FormData`. It sends the body directly, without JSON or Base64
encoding. For raw files, use a typed `Blob` or `File` so `fetch`
sets the intended `Content-Type`. `FormData` sends multipart data,
which is usually not the intended attachment bytes. Stream body
support depends on the platform; the helper has no option for
Node's streaming `duplex` setting.

This Node.js example uses web primitives also available in modern
browsers. Replace the byte array with the bytes from your input.

```ts
import {
  HttpError,
  JsonMetaClient,
} from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail"],
});
const accountId = (await client.session).primaryAccounts[
  "urn:ietf:params:jmap:mail"
];
if (!accountId) throw new Error("No primary mail account");
const bytes = new Uint8Array([0, 128, 255, 10]);
try {
  const uploaded = await client.blob.upload(
    new Blob([bytes], { type: "application/octet-stream" }),
    { accountId },
  );
  console.log(
    uploaded.accountId,
    uploaded.blobId,
    uploaded.type,
    uploaded.size,
  );
} catch (error) {
  if (error instanceof HttpError)
    console.error(
      error.response.status,
      error.responseData,
    );
  throw error;
}
```

The result contains `accountId`, `blobId`, `type`, and byte `size`.
Keep the blob ID with its account. Uploading does not create an
Email or make the blob permanent: reference it in a subsequent
object creation. See [send an attachment](../examples.md#send-an-attachment).

In a browser, a file input supplies a `File` (a `Blob` subclass):

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail"],
});
const input = document.createElement("input");
input.type = "file";
input.addEventListener("change", () => {
  const file = input.files?.[0];
  if (!file) return;
  void client.blob.upload(file).then(
    (uploaded) =>
      console.log(
        uploaded.blobId,
        uploaded.type,
        uploaded.size,
      ),
    (error: unknown) =>
      console.error("Upload failed", error),
  );
});
document.body.append(input);
```

The browser must be allowed to access the session and transfer
origins through CORS. A file's `type` may be empty; use a new
`Blob([file], { type: "application/octet-stream" })` when an explicit
fallback media type is required.

## Download and consume the response

`download({ blobId, name, type, accountId? })` requires the blob ID,
desired filename and media type for the URL template. The returned
web `Response` has passed HTTP status checking, but its body has
not been read. Choose one body reader; use `response.clone()` if
you need to inspect a copy.

```ts
import {
  HttpError,
  JsonMetaClient,
} from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail"],
});
try {
  const response = await client.blob.download({
    blobId: "BLOB_ID",
    name: "attachment.bin",
    type: "application/octet-stream",
  });
  const bytes = new Uint8Array(
    await response.arrayBuffer(),
  );
  console.log(bytes.byteLength);
  // Alternatives: await response.blob() or await response.text().
} catch (error) {
  if (error instanceof HttpError)
    console.error(
      error.response.status,
      error.responseData,
    );
  throw error;
}
```

Use `blob()` for browser object URLs and revoke each object URL
when its preview/download UI is removed. Use `text()` only for
textual data. Reading as an `ArrayBuffer` preserves arbitrary
binary bytes in Node.js and browsers. Body-reading errors happen
after `download()` resolves and are platform errors; keep reads
inside your error boundary.

For both helpers, omitted `accountId` uses the primary **mail**
account, even if the blob belongs to another capability. Pass it
explicitly for shared/secondary/non-mail accounts and check the
session before relying on the default. The library does not select
an account based on the blob ID or validate account permissions.

Non-success HTTP statuses reject with `HttpError`; fetch failures
reject with `NetworkError`. Upload JSON parsing can also reject
with a native `SyntaxError`. See [Errors](../reference/errors.md)
for diagnostic fields and [get attachments](../examples.md#get-email-attachments)
for finding blob IDs in Email objects.
