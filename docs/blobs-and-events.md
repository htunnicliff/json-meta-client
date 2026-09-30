# Blobs and state changes

## Uploading and downloading

Blob HTTP operations use URLs from the session document. They are
separate from `client.api` method calls and are not automatically
batched with them. The byte upload endpoint is distinct from the
optional `Blob/upload` JMAP method exposed by the blob capability.

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

`upload(body, params?, options?)` accepts a fetch `BodyInit` and resolves to
the JMAP upload response containing `accountId`, `blobId`, `type`,
and `size`. Omit the upload account only when the session's primary
mail account is suitable. The current implementation sends an
`application/json` content-type header, including for raw upload
bodies; servers may use that type in the uploaded blob metadata.

`download(params, options?)` requires `blobId`, `name`, and `type`.
Its optional `accountId` defaults to the primary mail account. It expands the session's download URL and resolves to the
native `Response`; choose `text()`, `arrayBuffer()`, `blob()`, or a
stream according to your use case. Treat `Response.json()` parsing
errors as ordinary application parsing errors. Failed HTTP
operations reject with the [structured errors](errors.md).

Pass `{ signal }` as the third upload argument or second download
argument to cancel waiting for the session or fetching the blob.
See [cancellation](cancellation.md). Download response-body
consumption remains governed by Fetch and its signal.

The library does not impose the session's upload-size or upload
concurrency limits. Check the server's capabilities before sending
large bodies. [RFC 8620 sections 6 and 7](https://www.rfc-editor.org/rfc/rfc8620.html#section-6)
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
and `isPrimaryAccount`. The primary flag compares the account to
the session's primary mail account; it does not identify a primary
account separately for each capability. A state string is an opaque
protocol token, useful for a corresponding `changes` or
`queryChanges` call. A notification is not a full entity payload.

`pingSeconds` requests a ping interval and defaults to 30. An
`AbortSignal` closes the subscription. An already aborted signal
rejects the subscription operation without opening a stream, and
a signal can also cancel waiting for session discovery. The returned handle has
`Symbol.dispose` for explicit resource management; on runtimes
without that symbol the runtime fallback key is `disconnect`.
Applications should close subscriptions when their view or client
is no longer needed. The event source client manages its connection;
this API does not offer an `onError` callback or expose native
`EventSource` instances. Malformed event JSON, non-StateChange
events, and errors thrown by the handler are ignored by this API.
For event source protocol behavior, see
[RFC 8620 section 7.3](https://www.rfc-editor.org/rfc/rfc8620.html#section-7.3).
