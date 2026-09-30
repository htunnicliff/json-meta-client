# Server request limits

The client uses the active session's Core capability to keep API requests within
`maxCallsInRequest`, `maxSizeRequest`, and `maxConcurrentRequests`. Limits apply
per client instance; clients connected to the same server have separate queues.

## Splitting a batch

Calls stay in their original order. When a batch exceeds a call or size limit,
the client splits it into contiguous requests. The size calculation includes the
entire JSON body, including `using`, measured in UTF-8 bytes.

Result references must stay with their source calls in one request. If a group
of connected calls cannot fit by itself, those calls reject locally with
`JmapRequestLimitError`; unrelated calls can still run.

When connected calls fit but have other calls between them, the client keeps
the entire span together to preserve ordering. If that span cannot fit, every
call in it rejects. The client sends no request that it knows exceeds these limits.

Requests split from one batch run sequentially, even after a request fails.
Separate batches can overlap up to `maxConcurrentRequests`; requests wait for a
free slot before sending. A zero concurrency limit rejects calls locally.

## Limit errors and session refresh

`JmapRequestLimitError` has `kind: "request-limit"` and reports the exceeded
`limit`, its `maximum`, the attempted `actual` value, affected `methodCallIds`,
and HTTP `request` context. See [errors](errors.md) for handling it.

An omitted limit is treated as unbounded. A malformed limit produces
`JmapProtocolError`. Refreshing the session applies new limits to subsequent
batches; requests already partitioned or sent keep their existing limits.

## Other Core limits

The following table distinguishes limits enforced by the client from limits
that applications must handle or leave to the server:

| Advertised limit                       | Client behavior                                                           |
| -------------------------------------- | ------------------------------------------------------------------------- |
| `maxCallsInRequest`                    | Splits requests while keeping references with their sources.              |
| `maxSizeRequest`                       | Measures the full JSON body in UTF-8 bytes, then splits or rejects calls. |
| `maxConcurrentRequests`                | Queues API requests until a slot is available.                            |
| `maxObjectsInGet`, `maxObjectsInSet`   | Leaves method arguments unchanged; the server enforces these limits.      |
| `maxSizeUpload`, `maxConcurrentUpload` | Does not validate upload size or schedule blob uploads.                   |
| `collationAlgorithms`                  | Describes server sorting support; it does not affect batching.            |

The client does not paginate oversized `get` or `set` calls automatically.
Blob uploads use a separate endpoint and are outside the API request queue.
For the protocol definitions, see [RFC 8620 section 2](https://jmap.io/spec/rfc8620/#section-2).
See [batching](batching.md) for batch boundaries and [cancellation](cancellation.md)
for removing canceled calls from queued requests.
