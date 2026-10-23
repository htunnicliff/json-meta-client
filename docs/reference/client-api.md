# Client API

## `JsonMetaClient`

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  bearerToken: "<bearer-token>",
  sessionUrl: "https://your-provider.example/.well-known/jmap",
  capabilities: ["mail"],
});
```

**Constructor:** `new JsonMetaClient(options: Config<Capabilities>)`

Creates a client without sending a request. The constructor accepts a [`Config`](./configuration.md) object. Capability selections determine the API’s inferred TypeScript type.

## `api`

```ts
const pending = client.api.Mailbox.get(args, { id: "get-mailboxes" });
const result = await pending;
```

Each method takes its JMAP arguments and an optional `{ id?: string }` options object. The returned promise resolves to the response arguments and exposes:

| Member         | Description                                                  |
| -------------- | ------------------------------------------------------------ |
| `$id`          | Explicit or generated method-call ID                         |
| `$method`      | Protocol method name, such as `Mailbox/get`                  |
| `$args`        | Arguments after middleware, including lazy account injection |
| `ref(pointer)` | Typed result reference into this call’s response             |

These members belong to the promise. They are not added to the resolved response. See [Method Calls](../features/method-calls.md) and [Result References](../features/result-references.md).

## `session`

**Type:** `Promise<Session>`

Loads the session on first access and caches its promise. API calls, blob helpers, and subscriptions also load the session when needed. Concurrent callers share the cached promise, including its rejection if loading fails.

## `refreshSession()`

**Returns:** `Promise<Session>`

Retrieves a fresh session and replaces the cached promise. Use it to refresh server metadata or retry a failed initial load. Configured capability support is checked on the first successful load; discrepancies produce console warnings.

## `blob.upload(body, params?)`

- `body`: Fetch API `BodyInit`.
- `params`: optional `{ accountId?: string }`.
- Returns `Promise<BlobUploadResponse>` with the server’s blob metadata.

## `blob.download(params)`

- `params`: `{ blobId: string; name: string; type: string; accountId?: string }`.
- Returns `Promise<Response>` for the downloaded body.

Both helpers default to the primary mail account and use the session’s URL templates. See [Blobs](../features/blobs.md).

## `onStateChange(handler, options?)`

The handler receives either `(null, StateChangePayload)` or `(StateChangeError, undefined)`.

Options are `{ pingSeconds?: number; signal?: AbortSignal }`, with `pingSeconds` defaulting to `30`.

Returns `Promise<Disposable>`. The implementation supplies `[Symbol.dispose]()` when the symbol exists, or `disconnect()` otherwise. You can also close the stream by aborting the supplied signal. See [Events](../features/events.md) for setup, cleanup, and state-token handling.

## `cancelBatch()`

**Returns:** `void`

Rejects currently queued method calls with `CancellationError` when called before the batch flush. It does not abort in-flight requests. Later calls may still run, but repeated cancellation does not cancel later batches in the current implementation. See [Batching](../features/batching.md).
