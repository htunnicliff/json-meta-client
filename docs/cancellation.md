# Cancellation

Each method accepts client options as its second argument. These options are never included in the JMAP arguments sent to the server.

```ts
const controller = new AbortController();
const pending = client.api.Email.get({ ids: ["message-id"] }, { signal: controller.signal });
controller.abort("Message view closed");
```

Canceled calls reject promptly with `JmapAbortError`, exported from `json-meta-client`. It extends `JmapClientError`, has `kind: "abort"` and the standard `name: "AbortError"`. The signal's abort reason is available as both `reason` and `cause`.

| Timing                                            | Behavior                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------ |
| Signal already aborted                            | Reject the call without running middleware or sending its method   |
| Waiting for a batch, discovery, or a request slot | Reject immediately and omit the canceled call before sending       |
| Request already sent, siblings still active       | Reject the canceled promise; retain the shared request and payload |
| Every call in a sent request canceled             | Abort the shared HTTP request                                      |
| Call already settled                              | Subsequent cancellation has no effect                              |

If a source call is canceled before sending, dependent calls using `ref()` reject with an abort error and are omitted too. This propagates through chains of references. Unrelated calls continue. If the source has already been sent, its server invocation remains available for references; its canceled promise rejects but active dependent calls may still complete normally.

Signals do not cancel shared session discovery needed by other operations. When discovery completes, canceled calls are checked again before sending. Shared transport cancellation uses a standard Fetch `signal`; custom Fetch implementations must honor that signal to stop their own network work. Logical promises still reject promptly when Fetch ignores cancellation.

Blob upload accepts options as a third argument, and download accepts options as a second argument:

```ts
await client.blob.upload(file, { accountId: "account" }, { signal });
await client.blob.download({ blobId, name: "attachment", type: "application/pdf" }, { signal });
```

Their signals cover waiting for session discovery and fetching the blob. A successful download returns the Fetch Response; its Fetch signal also applies while consuming the response body. Abort listeners for method calls are removed when the calls settle. Application middleware exceptions retain their original identity; cancellation before middleware skips it.

State change subscriptions accept `signal` in their existing options argument. A pre-aborted signal prevents opening a stream. Canceling during discovery or module loading rejects the subscription promise. Once subscribed, cancellation closes the event stream; explicit disposal also removes its abort listener.
