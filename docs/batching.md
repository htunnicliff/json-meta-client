# Automatic batching

Calling a method queues it immediately and returns a promise.
The client automatically starts a batch at the next microtask
checkpoint. All calls queued before that flush starts are sent
in call order, splitting into requests when required by server
limits. You do not need to await a call to make it eligible to be
sent.

Calls issued synchronously share a batch, including independent
calls. They share a request when the advertised limits allow it.
Awaiting their promises afterward does not change the batch they
belong to:

```ts
const a = client.api.Email.query({ limit: 10 });
const b = client.api.Mailbox.query({ limit: 10 });
await a;
await b;
```

Awaiting a call before issuing the next one creates a boundary:

```ts
const a = await client.api.Email.query({ limit: 10 });
const b = await client.api.Email.get({ ids: a.ids });
```

These calls produce two requests. Yielding with
`await Promise.resolve()` after queuing a call also lets the
scheduled flush start before the following call is queued.
Microtasks run in the order they were queued: a call from a
microtask queued before the flush can join that batch; a call
from a microtask queued after the flush belongs to a new batch.
Calls from different microtasks therefore only share a request
when both run before the same flush.

A batch's membership is fixed when its flush starts, even if the
client is still loading the session or waiting for the server.
New calls form another batch, which can be sent and finish while
the earlier request is still in flight. Separate batches are not
serialized; await the earlier call if execution order matters.

Use `ref(pendingCall, "/ids")` to express a dependency without
awaiting the source call, as in the example above. The client
sends the reference as a JMAP `#ids` argument; the server resolves
it. Several calls may reference the same pending call. Queue the
source first and its dependents before the same flush. References
are local to one request: `ref()` does not move calls between
batches or validate that they share a batch. After awaiting a
source, pass its returned values to the next request instead.

Each call's promise settles using its own response ID, even when
responses arrive in a different order. A method-level error rejects
that call and leaves successful calls in the request resolved.
Dependent calls settle according to their own server responses.
An HTTP or transport failure rejects all calls in the affected
request with the same error; other split requests continue. A
missing method response rejects the corresponding call. A failure while processing the batch rejects
any promises still pending; promises already settled keep their
results. Processing failures are handled for both synchronous
throws and asynchronous rejections. Later batches can still run.

The client reads `maxCallsInRequest`, `maxSizeRequest`, and
`maxConcurrentRequests` from the active session's Core capability.
Calls are partitioned into contiguous requests in their original order.
The complete JSON body, including `using`, counts toward the UTF-8 byte
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
features. There is no manual flush operation. Per-call
`AbortSignal` behavior, including shared requests and dependent
references, is described in [cancellation](cancellation.md).

See [server request limits](request-limits.md) for the complete Core capability audit.

See [result references](results-and-references.md) and [errors](errors.md).
