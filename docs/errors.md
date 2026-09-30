# Errors

Client failures use subclasses of `JmapClientError`, exported from
`json-meta-client`. Use `instanceof` or the `kind` field to identify them rather
than parsing messages. Exceptions from application middleware keep their original
identity; see [middleware](middleware.md) for where to catch them.

## Error classes

| Class                                 | `kind`          | Context                                                                                         |
| ------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------- |
| `JmapError` (alias `JmapMethodError`) | `method`        | Server `type`, optional `description`, original `details`, `methodCall`, and `methodCallId`.    |
| `JmapHttpError`                       | `http`          | HTTP `status`, original `response`, parsed or raw `payload`, and `request`.                     |
| `JmapTransportError`                  | `transport`     | `request` and the original Fetch exception in `cause`.                                          |
| `JmapProtocolError`                   | `protocol`      | Available `request`, `response`, `payload`, `methodCall`, and parsing `cause`.                  |
| `JmapConfigurationError`              | `configuration` | Invalid options or unsupported usage, with an underlying `cause` when available.                |
| `JmapRequestLimitError`               | `request-limit` | Exceeded `limit`, `maximum`, attempted `actual` value, affected `methodCallIds`, and `request`. |
| `JmapAbortError`                      | `abort`         | `name: "AbortError"`, the signal's `reason`, and matching `cause`.                              |

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

`JmapMethodError` and `JmapError` are names for the same constructor, so either
works with `instanceof`. `JmapError` retains its existing constructor and
problem-details fields; `details` also preserves additional server properties.

## HTTP context and response bodies

`request` contains the URL and HTTP method, without authorization headers.
`response` is the original Fetch `Response`; its body may already be consumed.

An HTTP failure remains `JmapHttpError` even when its error body contains malformed
JSON. In that case, `payload` contains the raw text and `cause` identifies the
parsing failure. Otherwise, the HTTP payload is also available as `cause` for
compatibility.

## Method and batch failures

A method error rejects its associated call. A missing or unusable method response
produces a protocol error for the affected calls; an invalid overall response or
transport failure rejects all calls in the request. Implicit responses associated
with a requested call are accepted without replacing its result.

A resolved method promise can still contain per-object failures. For example,
inspect a `set` response's `notCreated`, `notUpdated`, and `notDestroyed` fields,
and a `get` response's `notFound` field. These protocol results remain response
data rather than rejected promises.

Request limit errors reject calls locally before an oversized request is sent.
Other requests can continue. See [batching](batching.md#how-calls-settle) for
failure scope and [server request limits](request-limits.md) for dependency rules.

## Warnings and event streams

A configured capability missing from the initial session produces a
`JmapConfigurationError` passed to `logger.warn`; it does not reject discovery.
State change subscriptions ignore malformed events, and the underlying event
source implementation manages stream errors. See
[blobs and state changes](blobs-and-events.md#event-source-updates).
