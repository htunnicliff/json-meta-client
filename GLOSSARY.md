# json-meta-client

A typed JMAP client library. It turns calls on capability entities into
batched JMAP Requests and settles each call from the server's Response.

## Language

**Method call**:
One invocation of a JMAP method, such as `Email/get`, made through the client.
_Avoid_: invocation (reserve for the RFC 8620 wire tuple), job

**Batch**:
The method calls made in the same tick, sent together as one JMAP Request.
_Avoid_: queue, bundle

**Dispatcher**:
The client's owner of batches: it collects method calls into a batch, sends it,
and settles each method call from the Response.
_Avoid_: request pipeline, exchange, call queue, flush
