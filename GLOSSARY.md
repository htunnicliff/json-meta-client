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

**Capability details**:
The data a server advertises for a capability URN, server-wide in the
Session's `capabilities` or per account in `accountCapabilities`. Each RFC file
exports the details it defines, and `src/rfc-types/extensions.ts` maps every
known URN to them.
_Avoid_: capability extensions, metadata registry

**Contract extension**:
Properties or filter conditions that one capability adds to another
capability's method contracts, such as S/MIME's `smime*` properties on
`Email/get`. The client passes the extensions of its configured capabilities
to each contract that declares an `extensions` field.
_Avoid_: augmentation (reserve for TypeScript module augmentation), capability details

**Extending capability**:
A built-in capability that adds contract extensions instead of methods, and
that the client requires to be configured with the capability it extends.
`smime` extends `mail`.
_Avoid_: plugin, add-on
