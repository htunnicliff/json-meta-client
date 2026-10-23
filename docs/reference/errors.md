# Errors

Failures can occur before a call is queued, while an HTTP request is running, or inside a successful JMAP response. Handle the level relevant to your operation.

## Narrow a caught error

Library errors extend `JsonMetaError`. Each exported class has a matching guard, such as `isHttpError`:

```ts
import { isHttpError, isJmapError } from "json-meta-client";

try {
  await client.api.Mailbox.get({});
} catch (error) {
  if (isHttpError(error)) {
    console.error("Request failed with HTTP status", error.status);
  } else if (isJmapError(error)) {
    console.error("Method failed:", error.type, error.detail);
  } else {
    throw error;
  }
}
```

Keep a fallback for other values. For example, invalid JSON in a successful response can throw `SyntaxError`, and after-response hook exceptions are passed through unchanged.

Errors may retain requests, configuration, or method arguments. Log selected fields rather than entire objects when those objects could contain credentials or private data.

## Configuration

| Class                          | Meaning                                                                       | Useful fields                          |
| ------------------------------ | ----------------------------------------------------------------------------- | -------------------------------------- |
| `ConfigurationError`           | Invalid client setup or an unavailable session during lazy account resolution | `cause`, when provided                 |
| `CapabilityConfigurationError` | An unknown built-in capability or invalid definition                          | `givenCapability`, `availableBuiltIns` |

`CapabilityConfigurationError` extends `ConfigurationError`. Constructor validation is synchronous, so catch it around construction rather than around a later method promise.

A configured capability missing from the server's first successfully loaded session produces a console warning. It does not prevent calls from being sent.

## HTTP and network failures

| Class          | Meaning                                                              | Useful fields                                   |
| -------------- | -------------------------------------------------------------------- | ----------------------------------------------- |
| `HttpError`    | A returned response has `ok === false`                               | `status`, `request`, `response`, `responseData` |
| `NetworkError` | Request preparation, sending, or reading a JSON response body failed | `request` when available, `cause`               |

For `HttpError`, `responseData` holds parsed JSON or text when the body could be read. A before-request hook exception is wrapped in `NetworkError` unless it is already a `JsonMetaError`.

Session and transport failures reject every method in the affected batch. Reading a downloaded blob's body is the caller's responsibility; errors from that read need their own handling.

## Method failures

`JmapError` represents a method error with a string `type`. It exposes that type, the original details as `cause`, and the associated `methodCall` when available. Optional detail fields are `detail`, `instance`, `limit`, `methodCallId`, and `status`.

`MethodCallError` means the client could not use the method response: it was missing, had an unexpected method name, or supplied unrecognized error details. Diagnostic fields are `methodCall` and `responseData` when available.

These failures reject the affected promise. Other methods in the batch may still succeed.

### Record-level failures

A `set` response can resolve while some requested changes fail. Check `notCreated`, `notUpdated`, and `notDestroyed` alongside the successful result fields. These entries do not become rejected promises. The [mark-as-read recipe](../introduction/examples.md#mark-a-message-as-read) demonstrates this check.

## Cancellation and subscriptions

`CancellationError` rejects work removed from the queue by `cancelBatch()`. It does not mean an in-flight fetch was aborted. See the current limits in [Batching](../features/batching.md).

`StateChangeError` is passed to an event handler when an incoming notification cannot be processed. Subscription setup failures instead reject `onStateChange()`. See [Events](../features/events.md) for cleanup and asynchronous handler work.

## URL templates and fallback errors

`InvalidUriTemplateError` reports a supplied parameter whose placeholder is absent from a session URL template. It exposes `uriTemplate`, `givenParameters`, and `availableParameters`.

`UnknownError` is a fallback, including when `JmapError` is constructed with unrecognized problem details.

All the classes on this page, their matching `is*Error` guards, and `isJsonMetaError` are available from `json-meta-client`.
