# Client API

Import the client from the package root:

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://your-provider.example/.well-known/jmap",
  bearerToken: "<bearer-token>",
  capabilities: ["mail"],
});
```

## Constructor

`new JsonMetaClient(options: Config<Capabilities>)`

Validates the configuration and creates the client. Construction does not perform network I/O. The capability array determines the inferred API type. See [Configuration](./configuration.md) for required and optional fields.

## `api`

`client.api.<Entity>.<method>(arguments, options?)`

Queues a JMAP method and returns a promise for its response arguments. The optional options object has one field, `id?: string`, for choosing the call ID. Keep IDs unique within a batch.

The original promise has these additional members:

| Member         | Value                                                        |
| -------------- | ------------------------------------------------------------ |
| `$id`          | Chosen ID, or a generated `<Entity>/<method>::<random-UUID>` |
| `$method`      | JMAP method name, such as `Email/get`                        |
| `$args`        | Arguments after middleware has run                           |
| `ref(pointer)` | A typed reference to a value in this method's response       |

The automatically injected account ID in `$args` needs a loaded session before it can be read. These promise members do not become properties of the resolved response.

See [Method calls](../features/method-calls.md) for accounts and outcomes, and [Batching](../features/batching.md) for scheduling.

## `session`

`Promise<Session>`

Gets the cached session promise, starting a session request on first access. Methods, blob helpers, and subscriptions also access it as needed.

Concurrent callers share the promise. Its rejection is cached as well; requesting `client.session` again does not retry a failed load.

## `refreshSession()`

`refreshSession(): Promise<Session>`

Starts a fresh session request and replaces the cached promise. Use it to reload endpoint and account metadata or to retry a failed session load.

On the first successful load, configured entity capabilities are compared with the session's advertised capabilities. Missing support produces a console warning rather than blocking requests.

## `blob.upload()`

`blob.upload(body, params?): Promise<BlobUploadResponse>`

| Parameter          | Type               | Meaning                                              |
| ------------------ | ------------------ | ---------------------------------------------------- |
| `body`             | `BodyInit`         | Bytes or another Fetch-compatible request body       |
| `params.accountId` | `string`, optional | Upload account; defaults to the primary mail account |

Uses the session's upload URL and returns the server's metadata, including `accountId`, `blobId`, `type`, and `size`.

## `blob.download()`

`blob.download(params): Promise<Response>`

| Parameter   | Type               | Meaning                                              |
| ----------- | ------------------ | ---------------------------------------------------- |
| `blobId`    | `string`           | Stored blob to retrieve                              |
| `name`      | `string`           | Filename for the download URL                        |
| `type`      | `string`           | Media type for the download URL                      |
| `accountId` | `string`, optional | Blob's account; defaults to the primary mail account |

Returns a Fetch `Response` whose body the caller consumes. Both blob helpers use HTTP hooks and run independently of method batches. See [Blobs](../features/blobs.md).

## `onStateChange()`

`onStateChange(handler, options?): Promise<Disposable>`

The handler accepts either `(null, StateChangePayload)` or `(StateChangeError, undefined)`.

| Option        | Default | Meaning                                |
| ------------- | ------- | -------------------------------------- |
| `pingSeconds` | `30`    | Requested server ping interval         |
| `signal`      | None    | An abort event closes the subscription |

The promise resolves after subscription setup, without waiting for a confirmed connection. The returned object has `[Symbol.dispose]()` when that symbol exists at runtime, or `disconnect()` otherwise. Passing a fresh abort signal provides a consistent cleanup mechanism.

See [Events](../features/events.md) for state handling and the distinction between setup and callback errors.

## `cancelBatch()`

`cancelBatch(): void`

Rejects calls still in the queue with `CancellationError`. Call it synchronously before the batch flush. It does not abort an HTTP request already in progress.

Only the first invocation triggers cancellation because the client retains one abort controller. Later calls can run, but subsequent invocations of `cancelBatch()` do not cancel their batches. See [Batching](../features/batching.md).
