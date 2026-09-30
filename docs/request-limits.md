# Server request limits

The client reads `maxCallsInRequest`, `maxSizeRequest`, and
`maxConcurrentRequests` from the active session's Core capability.
Calls are partitioned into contiguous requests in their original order.
The complete JSON body, including `using`, counts toward the UTF8 byte
limit. Split requests from one batch run sequentially, including after a
failed request; separate batches may overlap up to the advertised
concurrency limit. Queued API requests wait for a free slot. Refreshing
the session applies new limits to subsequent batches. Omitted limits
are treated as unbounded; malformed limits produce a protocol error.

Calls connected by result references stay in the same request. If a
connected group cannot fit by itself, those calls reject locally with
`JmapRequestLimitError`; unrelated calls can still run. Interleaved
references may require an entire contiguous block to stay together to
preserve call order. If that block cannot fit, all calls in it reject.
The error exposes `limit`, `maximum`, `actual`, `methodCallIds`, and
`request`, with `kind: "request-limit"`. A zero concurrency limit also
rejects locally. No request known to exceed these limits is sent.

Core `maxObjectsInGet` and `maxObjectsInSet` constrain individual method
arguments rather than batching; the client does not rewrite or paginate
those calls. Core `maxSizeUpload` and `maxConcurrentUpload` apply to the
separate blob upload endpoint. These method and upload limits remain
server-enforced; automatic pagination and upload scheduling are separate
features. There is no manual flush operation. Per-call `AbortSignal`
behavior is described in [cancellation](cancellation.md).

## Core capability audit

| Advertised limit                       | Client behavior                                                                               |
| -------------------------------------- | --------------------------------------------------------------------------------------------- |
| `maxCallsInRequest`                    | Split contiguous method groups without breaking result references.                            |
| `maxSizeRequest`                       | Measure the full JSON request body in UTF8 bytes; split or reject locally.                    |
| `maxConcurrentRequests`                | Queue API requests across batches until a slot is available.                                  |
| `maxObjectsInGet`, `maxObjectsInSet`   | Per-method constraints; automatic pagination and rewriting are separate features.             |
| `maxSizeUpload`, `maxConcurrentUpload` | Separate upload endpoint constraints; upload validation and scheduling are separate features. |
| `collationAlgorithms`                  | Advertises sorting support; it does not affect request partitioning.                          |

The limits are defined by [RFC 8620 § 2](https://jmap.io/spec/rfc8620/#section-2). Request limits apply per client instance; several clients using the same server do not share a scheduler. Refreshing a session does not alter requests already partitioned or sent.
