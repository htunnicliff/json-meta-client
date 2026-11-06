<!-- cspell:words behaviour recognise -->

# Errors

All classes and guards below are exported from `"json-meta-client"`. Every library error extends `JsonMetaError`, which extends native `Error` and retains `message`, `name`, `stack`, and optional `cause`. `CapabilityConfigurationError` additionally extends `ConfigurationError`; the other classes directly extend `JsonMetaError`.

Not every thrown value is a library error. Invalid successful JSON raises native `SyntaxError`; user middleware, Fetch response hooks and JMAP envelope hooks can throw their own values. Catch `unknown` and retain the original error for diagnostics.

## Transport and method errors

| Class             | Structured fields                                                                                                                  | Typical trigger                                                                                                                                                                                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NetworkError`    | `request: Request \| undefined`, original `cause`                                                                                  | Request construction, authentication/request-hook failure, fetch failure, or failure reading a JSON response body. Existing `JsonMetaError` values in the request/fetch path pass through.                                                                                 |
| `HttpError`       | `request: Request`, `response: Response`, `responseData: unknown`, getter `status: number`, optional parsing `cause`               | A non-OK HTTP response or invalid event-stream response, after Fetch response hooks. Stream validation does not read the body. JSON bodies are decoded when the content type contains `json`; other bodies are text. If body decoding fails, `cause` records that failure. |
| `JmapError`       | `type: string`; optional `detail`, `instance`, `limit`, `methodCallId`, `status`, `methodCall`; original problem object as `cause` | A method response named `error` with a string `type`. The associated `methodCall` is included for failures received by the client.                                                                                                                                         |
| `MethodCallError` | `methodCall`, `responseData: unknown`                                                                                              | No response for an invocation ID, an unexpected response method, or a method error payload without a string `type`.                                                                                                                                                        |
| `UnknownError`    | Standard error fields and optional `cause`                                                                                         | Constructing `JmapError` with a cause that fails `JmapError.isProblemDetails`. It is not a universal wrapper for unknown failures.                                                                                                                                         |

`methodCall`, where present, exposes `id`, `method`, `args`, and `toInvocation()`; its implementation class is not a public import. `JmapError.isProblemDetails(value)` only checks that `value` is a non-null object with a string `type`, rather than validating every optional field.

[JMAP request errors](https://www.rfc-editor.org/rfc/rfc8620.html#section-3.6) such as an HTTP 400 problem response become `HttpError`, preserving its decoded body. [Method errors](https://www.rfc-editor.org/rfc/rfc8620.html#section-3.6.2) inside an HTTP-success response become `JmapError`. A failure of the whole batch transport rejects all its calls; an individual method error rejects that call. JMAP envelope hook failures reject every pending call in the batch, unchanged; Fetch request-hook failures instead follow the `NetworkError` boundary described above.

```ts
import {
  HttpError,
  JmapError,
  JsonMetaClient,
  NetworkError,
} from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail"],
});

try {
  await client.api.Email.get({
    accountId: "ACCOUNT_ID",
    ids: ["EMAIL_ID"],
  });
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
      error.detail,
    );
  } else if (error instanceof NetworkError) {
    console.error(
      "Transport failure",
      error.request?.url,
      error.cause,
    );
  }
  throw error; // Preserve its identity, structured fields, and causal chain.
}
```

## Configuration errors

| Class                          | Fields and behaviour                                                                                                                                                                                                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ConfigurationError`           | Standard error fields and optional `cause`. Invalid authentication, session URL, capability array, or middleware throws synchronously during construction. Missing configured server capabilities instead produce a warning on the first successful session load. |
| `CapabilityConfigurationError` | Adds `givenCapability: unknown` and `availableBuiltIns: readonly string[]`. Unknown built-in keys or malformed descriptors fail synchronously.                                                                                                                    |
| `InvalidUriTemplateError`      | Adds `uriTemplate: string`, `givenParameters: Record<string, string>`, `availableParameters: readonly string[]`. Blob/event URL expansion rejects when supplied parameters are absent from the template.                                                          |

The capability warning does not prove account support or prevent a subsequent server error. See [Capabilities](/features/capabilities) for selection and validation details.

## Cancellation and event callbacks

| Class               | Delivery and trigger                                                                                                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CancellationError` | Rejects methods still queued when their API queue is cancelled. In-flight fetches are not aborted. See [Batching](/advanced/batching).                                                                          |
| `StateChangeError`  | Passed to the state-change handler as `(error, undefined)`, with a stream connection or parsing/processing exception in `cause`. Includes errors thrown by the success handler. See [Events](/features/events). |

Event subscription setup failures reject `onStateChange()` itself; callback error delivery is a separate path. Connection failures, including authentication, Fetch, connection-hook and stream-validation failures, reach the handler unless intentionally aborted. The transport retains its reconnect behaviour. Exceptions from the error handler are not recursively wrapped. Async handler promise rejections are not caught by the synchronous message processor.

## Guards and constructors

Every error class has a matching exported guard: `isJsonMetaError`, `isCancellationError`, `isCapabilityConfigurationError`, `isConfigurationError`, `isHttpError`, `isInvalidUriTemplateError`, `isJmapError`, `isMethodCallError`, `isNetworkError`, `isStateChangeError`, and `isUnknownError`. Each has signature `(input: unknown) => input is CorrespondingClass` and uses `instanceof`; `isConfigurationError` also accepts capability configuration errors. Guards do not structurally recognise JSON or errors created by a different installed copy of the package.

These classes are normally received from client operations. Their public constructor contracts are:

| Classes                                                                                        | Constructor                                                                                                                                       |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `JsonMetaError`, `ConfigurationError`, `CancellationError`, `StateChangeError`, `UnknownError` | `(message?: string, options?: ErrorOptions)` inherited from `Error`.                                                                              |
| `CapabilityConfigurationError`                                                                 | `(message: string, options: { capability: unknown })`.                                                                                            |
| `HttpError`                                                                                    | `(message: string, options: { request: Request; response: Response; responseData?: unknown; cause?: unknown })`.                                  |
| `InvalidUriTemplateError`                                                                      | `(message: string, options: { template: string; params: Record<string, string> })`.                                                               |
| `JmapError`                                                                                    | `(message: string, cause: unknown, options?: { methodCall?: MethodCall })`; options defaults to `{}`. Invalid problem data throws `UnknownError`. |
| `MethodCallError`                                                                              | `(message: string, options: { methodCall: MethodCall; responseData?: unknown })`.                                                                 |
| `NetworkError`                                                                                 | `(message: string, options: { cause: unknown; request: Request \| undefined })`.                                                                  |

`MethodCall` above describes the exposed call object; it is not a package export.

## Per-object set failures

A successful `/set` response can contain `notCreated`, `notUpdated`, or `notDestroyed` entries. These are protocol data, not thrown errors. Each failure has a `type`, may have a `description`, and may carry operation-specific fields such as invalid properties. Inspect them even when `await` succeeds, as specified in [RFC 8620 §5.3](https://www.rfc-editor.org/rfc/rfc8620.html#section-5.3).

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail"],
});

// Requires a writable mail account with permission to create mailboxes.
const result = await client.api.Mailbox.set({
  accountId: "ACCOUNT_ID",
  create: { newMailbox: { name: "Archive" } },
});
for (const [creationId, failure] of Object.entries(
  result.notCreated ?? {},
)) {
  console.error(
    creationId,
    failure.type,
    failure.description,
    failure,
  );
}
console.log(
  result.created?.newMailbox?.id ??
    "Mailbox was not created",
);
```

For reads, missing IDs can appear in `notFound` within a successful result. Do not equate a resolved promise with success for every requested object.
