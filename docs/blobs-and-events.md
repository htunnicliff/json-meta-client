# Blobs and state changes

## Uploading and downloading

Use `client.blob` to transfer bytes through the upload and download
URLs in the session document. These HTTP operations run separately
from batched API calls. `client.blob.upload()` also differs from the
optional `Blob/upload` API method provided by the blob capability.

```ts
const uploaded = await client.blob.upload(new Blob(["hello"], { type: "text/plain" }), {
  accountId: "<account-id>",
});
const response = await client.blob.download({
  accountId: uploaded.accountId,
  blobId: uploaded.blobId,
  name: "hello.txt",
  type: "text/plain",
});
console.log(await response.text());
```

`upload(body, params?, options?)` accepts a Fetch `BodyInit` and
returns metadata containing `accountId`, `blobId`, `type`, and `size`.
Omitting `accountId` selects the primary mail account.

The client currently sends `Content-Type: application/json` for every
upload, including raw bytes. The `Blob`'s `text/plain` type in this
example does not override that header; the server may report the
header's type in its metadata.

`download(params, options?)` requires `blobId`, `name`, and `type`.
The optional `accountId` defaults to the primary mail account. The
client expands the session's download URL and returns a native
`Response`. Read it with `text()`, `arrayBuffer()`, `blob()`, or a stream.
HTTP failures reject with [client errors](errors.md); errors while
your application parses the returned body, such as with `json()`,
retain their ordinary Fetch or parsing error types.

Pass `{ signal }` as the third upload argument or second download
argument to cancel waiting for the session or fetching the blob.
See [cancellation](cancellation.md). Download response-body
consumption remains governed by Fetch and its signal.

The server enforces upload-size and upload-concurrency limits. The
client neither validates size nor queues uploads to meet those limits;
check the session's capabilities when planning large or concurrent uploads. [RFC 8620 sections 6 and 7](https://www.rfc-editor.org/rfc/rfc8620.html#section-6)
describe the blob endpoints.

## Event source updates

`onStateChange(handler, options?)` opens the session's event source
URL with bearer authentication and requests all entity types.
The handler receives one item for each changed account/entity:

```ts
const controller = new AbortController();
const subscription = await client.onStateChange(
  (change) => {
    console.log(change.entity, change.accountId, change.state);
  },
  { pingSeconds: 30, signal: controller.signal },
);

controller.abort();
subscription[Symbol.dispose]();
```

Each `StateChangePayload` contains `entity`, `state`, `accountId`,
and `isPrimaryAccount`. `isPrimaryAccount` compares the changed account to the primary mail
account, regardless of the entity's capability. Notifications contain
state tokens rather than full objects. Use the relevant `changes` or
`queryChanges` method to retrieve updates; treat state strings as opaque.

`pingSeconds` requests a server ping interval, defaulting to 30 seconds.
Close the subscription when its view or client is no longer needed.
You can abort its signal or call `subscription[Symbol.dispose]()`;
runtimes without `Symbol.dispose` use the `disconnect` key instead.
An already aborted signal prevents the stream from opening, and the
signal also cancels waiting for session discovery.

The underlying event source client manages the connection. This API
has no `onError` callback and does not expose a native `EventSource`.
Malformed event JSON, events other than `StateChange`, and exceptions
from your handler are ignored.
For event source protocol behavior, see
[RFC 8620 section 7.3](https://www.rfc-editor.org/rfc/rfc8620.html#section-7.3).
