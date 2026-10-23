# Errors

## Handling Errors

Library error classes extend `JsonMetaError`. Each class has an exported `is*Error` guard for narrowing caught values:

```ts
import { isHttpError, isJmapError } from "json-meta-client";

try {
  await client.api.Mailbox.get({});
} catch (error) {
  if (isHttpError(error)) {
    console.error("HTTP status:", error.status);
  } else if (isJmapError(error)) {
    console.error("JMAP error:", error.type, error.detail);
  } else {
    throw error;
  }
}
```

Errors can contain request objects, arguments, or configuration values. Choose diagnostic fields deliberately when logging; avoid exposing tokens or private data.

## Configuration Errors

`ConfigurationError` indicates invalid client configuration. It is thrown synchronously by constructor validation and can also occur while resolving lazily injected account IDs.

`CapabilityConfigurationError` extends `ConfigurationError` and adds:

- `givenCapability`: the invalid definition or built-in name.
- `availableBuiltIns`: supported built-in names.

An unsupported server capability produces a console warning on the first successful session load rather than a thrown exception.

## HTTP and Network Errors

| Error          | Meaning                                                 | Diagnostic fields                               |
| -------------- | ------------------------------------------------------- | ----------------------------------------------- |
| `HttpError`    | Received a response with `ok === false`                 | `status`, `request`, `response`, `responseData` |
| `NetworkError` | Could not prepare, send, or read a request successfully | `request` when available, `cause`               |

`responseData` contains parsed JSON or text when it could be read. Before-request hook failures are also wrapped in `NetworkError` unless they already extend `JsonMetaError`.

Transport or session failures reject all method calls sharing the affected batch.

## Method Errors

`JmapError` represents a JMAP method error with a string `type`. It exposes `type`, optional problem-detail fields (`detail`, `instance`, `limit`, `methodCallId`, `status`), and the associated `methodCall` when available. The original details are in `cause`.

`MethodCallError` indicates a missing response, an unexpected method name, or an error response without recognized problem details. It exposes `methodCall` and `responseData` when available.

These errors reject the affected method promise. Unrelated calls in the batch may succeed.

A successful `set` response can contain per-record failures in `notCreated`, `notUpdated`, or `notDestroyed`. Inspect those fields explicitly; they do not reject the promise.

## Cancellation and Events

`CancellationError` rejects queued calls cleared by `cancelBatch()`. It does not indicate that an in-flight HTTP request was aborted.

`StateChangeError` is delivered to an event subscription’s callback when processing an incoming message fails. Subscription setup errors instead reject `onStateChange()`. See [Events](../features/events.md).

## Other Errors

`InvalidUriTemplateError` means a supplied parameter has no matching placeholder in a session URL template. It exposes `uriTemplate`, `givenParameters`, and `availableParameters`.

`UnknownError` is a fallback library error, including when constructing a `JmapError` with unrecognized problem details.

Not every failure is wrapped in a library error. For example, malformed successful JSON can produce `SyntaxError`, and exceptions from after-response hooks propagate directly. Keep a fallback path when handling caught values.

All classes above have matching guards, such as `isNetworkError`, `isMethodCallError`, and `isJsonMetaError`, exported from `json-meta-client`.
