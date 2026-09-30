# Errors

All intentional client failures extend `JmapClientError`, exported from `json-meta-client`. Catch a category with `instanceof` or inspect its `kind`:

| Class                                            | kind            | Information                                                                                                           |
| ------------------------------------------------ | --------------- | --------------------------------------------------------------------------------------------------------------------- |
| `JmapError` (also exported as `JmapMethodError`) | `method`        | JMAP `type`, optional `description`, original server `details`, associated `methodCall` invocation and `methodCallId` |
| `JmapHttpError`                                  | `http`          | HTTP `status`, `response`, parsed or raw `payload`, and `request`                                                     |
| `JmapTransportError`                             | `transport`     | `request` and the original fetch exception in `cause`                                                                 |
| `JmapProtocolError`                              | `protocol`      | Available `request`, `response`, `payload`, `methodCall`, and parsing `cause`                                         |
| `JmapConfigurationError`                         | `configuration` | Invalid client options or unsupported usage, with an underlying `cause` when available                                |
| `JmapRequestLimitError`                          | `request-limit` | Advertised `limit`, `maximum`, attempted `actual`, affected `methodCallIds`, and `request`                            |

| `JmapAbortError` | `abort` | Standard `name: "AbortError"`, signal `reason`, and matching `cause` |

`request` contains the URL and HTTP method; it does not include authorization headers. `response` is the original Fetch Response. Its body may already have been consumed. HTTP failures keep their HTTP category even if the error body contains malformed JSON; `payload` retains the raw text and `cause` identifies the parsing failure. Without a parsing failure, the HTTP payload also remains available as `cause` for compatibility.

```ts
import { JmapClientError, JmapHttpError, JmapMethodError } from "json-meta-client";

try {
  await client.api.Email.get({ ids: ["message-id"] });
} catch (error) {
  if (error instanceof JmapMethodError) {
    console.error(error.type, error.description, error.methodCall);
  } else if (error instanceof JmapHttpError) {
    console.error(error.status, error.request.url);
  } else if (error instanceof JmapClientError) {
    console.error(error.kind, error.message, error.cause);
  } else {
    throw error;
  }
}
```

Method-level failures reject the associated pending call. Missing or unusable method responses reject affected calls with protocol errors. An invalid overall response or transport failure rejects all calls in the request. Additional implicit method responses associated with a requested call are accepted without replacing that call's result.

Exceptions thrown by application middleware retain their original identity and may occur synchronously while creating a method call. They are not converted to client errors. Session capability mismatches remain warnings, represented by configuration errors passed to the configured logger. State change streams continue ignoring malformed events; stream errors are managed by the underlying event source implementation.

`JmapError` keeps its previous constructor and problem-details fields. Its `details` property preserves every additional server property. `JmapMethodError` is an alias of the same constructor, so either name works with `instanceof`.

A request limit error rejects calls locally before sending an oversized request. Independent work in other partitions can continue. See [server request limits](./request-limits.md) for dependency and ordering constraints.
