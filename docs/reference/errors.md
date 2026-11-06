# Error reference

Failures can occur before a request is sent, across a whole request, within one
method, or for individual objects in a successful method. The delivery path
reflects that scope:

| Failure                                         | Where it appears                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------------------ |
| Invalid client configuration                    | A synchronous constructor throw.                                               |
| Session, transport, HTTP, or batch processing   | A rejected operation promise; a batch failure rejects all its unsettled calls. |
| A JMAP method error                             | That method's rejected promise. Successful siblings may still resolve.         |
| An individual set operation                     | `notCreated`, `notUpdated`, or `notDestroyed` in a fulfilled result.           |
| A stream connection or message-processing error | The state-change handler's error argument, after subscription setup.           |

Every library error extends `JsonMetaError`, which extends native `Error`.
`CapabilityConfigurationError` also extends `ConfigurationError`; the remaining
classes extend `JsonMetaError` directly. All classes and guards below are public
imports from `"json-meta-client"`.

Not every rejection is a library error. Invalid JSON in a successful response
can throw native `SyntaxError`. Middleware, Fetch response hooks, and JMAP
hooks can propagate their own thrown values. Catch values as `unknown` and
retain the original error when recording it or throwing it again.

## Transport and method errors

### `NetworkError`

Represents request construction, authentication, request-hook, fetch, or JSON
body-reading failure. Exposes `request: Request | undefined` and the original
`cause`. In the request/fetch path, an existing `JsonMetaError` passes through
instead of being wrapped.

### `HttpError`

Represents a non-success HTTP response after Fetch response hooks, or an invalid
event-stream response. Exposes `request: Request`, `response: Response`,
`responseData: unknown`, and a `status` getter for `response.status`.

For ordinary HTTP errors, a content type containing `json` causes the body to be
decoded as JSON; other bodies are decoded as text. A decoding failure is stored
as `cause`. Event-stream validation does not read the body.

A JMAP request-wide problem returned with an HTTP error status is an `HttpError`,
with its decoded problem in `responseData`. It is distinct from a method error
inside an HTTP-success response.

### `JmapError`

Represents a method response named `error` whose data has a string `type`.
Exposes `type`, optional `detail`, `instance`, `limit`, `methodCallId`, `status`,
and `methodCall`. The original problem object is its `cause`.

`JmapError.isProblemDetails(value)` checks only for a non-null object with a
string `type`; it does not validate every optional field. Constructing a
`JmapError` with a cause that fails this check throws `UnknownError`.

### `MethodCallError`

Represents a missing response for an invocation ID, an unexpected response
method, or a method error without a string `type`. Exposes `methodCall` and
`responseData: unknown`.

A `methodCall` on either error exposes `id`, `method`, `args`, and
`toInvocation()`. Its implementation class is not a public import.

### Diagnostic example

This wrapper distinguishes common request failures while preserving the
original rejection for its caller:

```ts
import {
  HttpError,
  JmapError,
  NetworkError,
} from "json-meta-client";

export async function withDiagnostics<T>(
  operation: Promise<T>,
): Promise<T> {
  try {
    return await operation;
  } catch (error: unknown) {
    if (error instanceof HttpError) {
      console.error(
        "HTTP failure",
        error.status,
        error.responseData,
      );
    } else if (error instanceof JmapError) {
      console.error(
        "Method failure",
        error.type,
        error.methodCall?.id,
        error.cause,
      );
    } else if (error instanceof NetworkError) {
      console.error(
        "Transport failure",
        error.request?.url,
        error.cause,
      );
    }
    throw error;
  }
}
```

Structured diagnostics may contain request or account data. Application logging
policy determines which fields are appropriate to record.

## Configuration and template errors

| Class                          | Trigger and additional fields                                                                                                           |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `ConfigurationError`           | Invalid authentication, session URL, capability array, or middleware. Standard error fields and optional `cause`.                       |
| `CapabilityConfigurationError` | Unknown built-in key or invalid capability descriptor. Adds `givenCapability: unknown` and `availableBuiltIns: readonly string[]`.      |
| `InvalidUriTemplateError`      | Supplied blob/event template parameters are absent from the template. Adds `uriTemplate`, `givenParameters`, and `availableParameters`. |

The template fields are respectively `string`, `Record<string, string>`, and
`readonly string[]`.

A configured capability missing from the server produces a logged
`ConfigurationError` warning on the first successful session load. It does not
reject that load or establish account support. See
[capability checks](../features/capabilities.md#read-capability-details-safely).

## Cancellation and subscriptions

`CancellationError` rejects methods removed from a pending queue. It does not
mean an in-flight request was aborted. The [batching guide](../advanced/batching.md#cancel-calls-that-are-still-queued)
describes its pending-only, one-shot scope.

`StateChangeError` reaches the handler as `(error, undefined)`, with the
underlying connection, parsing, or processing failure in `cause`. This includes
errors thrown synchronously by the success handler. Connection failures retain
the transport's reconnect behaviour unless the subscription is closed.
Intentional aborts do not report a connection failure.

Initial session and subscription setup failures reject `onStateChange()`
itself. Later callback errors use a separate path. Errors thrown by the error
handler are not recursively wrapped, and asynchronous handler rejections are
not caught. See [state subscriptions](../features/events.md).

`UnknownError` is used when constructing `JmapError` with invalid problem data.
It is not a general wrapper for all unrecognised failures.

## Per-object failures

A successful set result can contain `notCreated`, `notUpdated`, or
`notDestroyed`, keyed by creation ID or object ID. Each failure has a `type`,
may have a `description`, and can include operation-specific details, such as
invalid properties. These are protocol results rather than thrown errors.

Read results have a similar distinction: a fulfilled get can report requested
IDs in `notFound`. A resolved promise therefore does not establish success for
every object. The [method call guide](../features/method-calls.md#update-an-object-and-check-the-outcome)
shows a checked update.

## Type guards

Each guard has the signature `(input: unknown) => input is Class` and uses
`instanceof`. Guards do not recognise structurally similar JSON or errors from
a different installed copy of the package.

| Class                          | Guard                            |
| ------------------------------ | -------------------------------- |
| `JsonMetaError`                | `isJsonMetaError`                |
| `ConfigurationError`           | `isConfigurationError`           |
| `CapabilityConfigurationError` | `isCapabilityConfigurationError` |
| `InvalidUriTemplateError`      | `isInvalidUriTemplateError`      |
| `NetworkError`                 | `isNetworkError`                 |
| `HttpError`                    | `isHttpError`                    |
| `JmapError`                    | `isJmapError`                    |
| `MethodCallError`              | `isMethodCallError`              |
| `CancellationError`            | `isCancellationError`            |
| `StateChangeError`             | `isStateChangeError`             |
| `UnknownError`                 | `isUnknownError`                 |

`isConfigurationError` also accepts `CapabilityConfigurationError` instances.

## Constructors

Errors are normally received from client operations. Their public constructor
signatures are listed here for code that creates its own instances.

| Class                                                                                          | Constructor arguments                                                                                           |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `JsonMetaError`, `ConfigurationError`, `CancellationError`, `StateChangeError`, `UnknownError` | `(message?: string, options?: ErrorOptions)`                                                                    |
| `CapabilityConfigurationError`                                                                 | `(message: string, options: { capability: unknown })`                                                           |
| `InvalidUriTemplateError`                                                                      | `(message: string, options: { template: string; params: Record<string, string> })`                              |
| `NetworkError`                                                                                 | `(message: string, options: { cause: unknown; request: Request \| undefined })`                                 |
| `HttpError`                                                                                    | `(message: string, options: { request: Request; response: Response; responseData?: unknown; cause?: unknown })` |
| `JmapError`                                                                                    | `(message: string, cause: unknown, options?: { methodCall?: MethodCall })`                                      |
| `MethodCallError`                                                                              | `(message: string, options: { methodCall: MethodCall; responseData?: unknown })`                                |

`JmapError` defaults its third argument to `{}`. `MethodCall` above describes
the exposed call object, not an exported class name.
