# Upload and download files

Use `client.blob.upload()` and `client.blob.download()` to transfer binary data,
such as attachments. The helpers use the upload and download URL templates in
the server's session, and apply the same authentication and Fetch hooks as other
requests.

These HTTP helpers work without the `"blob"` capability. That key enables
additional JSON-based `Blob` methods through `client.api.Blob`; it does not
configure file transfers.

## Upload bytes, then read them back

Both helpers use the primary mail account. Pass a typed `Blob` or `File` so
`fetch` can set the intended media type. This example uploads a short text file,
then downloads it using the returned blob ID:

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail"],
});
const file = new Blob(["Report contents\n"], {
  type: "text/plain",
});

const uploaded = await client.blob.upload(file);
console.log(uploaded.blobId, uploaded.type, uploaded.size);

const response = await client.blob.download({
  blobId: uploaded.blobId,
  name: "report.txt",
  type: uploaded.type,
});
console.log(await response.text());
```

The final line prints `Report contents`. Upload returns the owning `accountId`,
`blobId`, media `type`, and byte `size`. Keep the blob ID with its account: a
blob ID alone does not tell the client which account to use.

Uploading does not create an email or make the blob permanent. Reference the
blob in a subsequent object creation, as shown in the
[attachment example](../examples.md#send-an-attachment).

## Choose the upload body

`upload` accepts the platform's `BodyInit` and sends it directly, without JSON
or Base64 encoding. A browser file input supplies a `File`, which is already a
`Blob`. Pass that file directly when its media type is suitable. If its `type`
is empty, wrap it in `new Blob([file], { type: "application/octet-stream" })`
to supply a fallback.

Strings, byte buffers, `URLSearchParams`, and `FormData` are also accepted body
types, but they produce different HTTP bodies. In particular, `FormData` sends
multipart data rather than just the file's bytes. For an ordinary attachment,
a `Blob` or `File` expresses the intended body and media type.

Streaming request bodies depend on the runtime. The helper has no option for
Node's streaming `duplex` setting. Keep uploads within the size and concurrency
limits advertised by your server.

## Consume a download response

`download` needs a blob ID, filename, and media type. The helper expands and
encodes the server's URL template; you do not need to construct the URL yourself.
It resolves to a web `Response` after HTTP status checking, with its body unread.

Choose the reader that matches the data:

| Reader                   | Suitable use                                              |
| ------------------------ | --------------------------------------------------------- |
| `response.arrayBuffer()` | Preserve arbitrary binary bytes for saving or processing. |
| `response.blob()`        | Create a browser preview or download with an object URL.  |
| `response.text()`        | Read known textual data.                                  |

A response body can be consumed once. Clone an ordinary response before reading
it twice. Revoke browser object URLs when their previews are removed, and choose
safe local filenames rather than treating an attachment name as a filesystem
path. A supplied filename or media type is metadata, not proof of file contents.

## Handle account and transfer failures

Both helpers default to the primary mail account when `accountId` is omitted.
Pass it explicitly for shared, secondary, or non-mail accounts. The client does
not infer the account from a blob ID or check transfer permissions for you.

A non-success HTTP status rejects with `HttpError`; fetch failures reject with
`NetworkError`. Upload also parses a JSON response, which can fail with a native
`SyntaxError`. A download's body reader can fail after `download()` has resolved,
so keep the body read inside your application's error boundary too. Neither
helper accepts a per-call abort signal or request options.

For browser transfers, allow the session and transfer origins through
[CORS and your Content Security Policy](./authentication.md#run-in-a-browser).
To find attachment blob IDs on an email, use the
[attachment download example](../examples.md#get-email-attachments).
