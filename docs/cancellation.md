# Cancellation

Pass an `AbortSignal` to cancel an API call. Method options are the second
argument and remain separate from the JMAP arguments sent to the server:

```ts
const controller = new AbortController();
const pending = client.api.Email.get({ ids: ["message-id"] }, { signal: controller.signal });
controller.abort("Message view closed");
```

The canceled promise rejects promptly with `JmapAbortError`, exported from
`json-meta-client`. This error extends `JmapClientError`, has `kind: "abort"`
and `name: "AbortError"`, and preserves the signal's abort reason in both
`reason` and `cause`.

## API calls in shared requests

Cancellation affects a call differently depending on whether its request has
been sent:

| When cancellation occurs                                  | Behavior                                                           |
| --------------------------------------------------------- | ------------------------------------------------------------------ |
| Signal already aborted when called                        | Rejects without running middleware or sending the method.          |
| While waiting for a batch, session, or request slot       | Rejects immediately and omits the method from the request.         |
| After sending, while other calls remain active            | Rejects the canceled promise and lets the shared request continue. |
| After sending, when every call in the request is canceled | Aborts the shared HTTP request.                                    |
| After the promise settles                                 | Leaves the result unchanged.                                       |

Canceling a source call before sending also cancels calls that depend on it
through `ref()`. This propagates through chains of references; unrelated calls
continue. After sending, the source method remains in the server's request, so
active dependent calls can still complete even though the source promise rejects.

Shared session discovery continues for other operations. Canceled calls are
checked again after discovery completes and before sending. Custom Fetch
implementations must honor the standard `signal` to stop network activity; the
client's promises still reject promptly if Fetch ignores it. Method abort
listeners are removed when calls settle.

## Blob operations

Upload options are the third argument; download options are the second:

```ts
await client.blob.upload(file, { accountId: "account" }, { signal });
await client.blob.download({ blobId, name: "attachment", type: "application/pdf" }, { signal });
```

The signal cancels waiting for discovery and fetching the blob. A successful
download returns a Fetch `Response`; its signal also applies while the response
body is being consumed.

## State change subscriptions

Pass `signal` in the options for `onStateChange()`. An already aborted signal
prevents opening a stream. Cancellation while loading the session or event source
module rejects the subscription promise; cancellation after subscribing closes
the stream. Explicit disposal also removes the abort listener. See
[blobs and state changes](blobs-and-events.md) for subscription examples.
