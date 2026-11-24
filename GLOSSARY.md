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

**JMAP Request**:
The JMAP envelope that carries a batch to the server, whatever the transport.

**JMAP Response**:
The JMAP envelope that carries the results of a batch back from the server,
whatever the transport.

**Transport**:
What carries each JMAP Request to the server and returns its JMAP Response,
such as HTTP or the JMAP WebSocket subprotocol. A client creates one from its
transport factory and shares it with every Dispatcher. It may also provide a
push channel.
_Avoid_: connection (one socket a transport may open), adapter, driver

**Push channel**:
What delivers the server's `StateChange` messages to the client: the
transport's own, such as WebSocket push, or else the session's event stream.
Every `onStateChange` handler of a client shares one.
_Avoid_: subscription (reserve for one handler's `onStateChange` registration), event source (only one kind of channel)

**Dispatcher**:
The client's owner of batches: it collects method calls into a batch, sends it,
and settles each method call from the Response.
_Avoid_: request pipeline, exchange, call queue, flush

**Capability details**:
The data a server advertises for a capability URN, server-wide in the
Session's `capabilities` or per account in `accountCapabilities`. Each RFC file
exports the details it defines, and `src/rfc-types/capability-details.ts` maps every
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

**Default account**:
The account whose ID the client adds to a method call that doesn't pass
`accountId`. It is the session's primary account for the URN of the
capability that owns the method, as that capability's `defaultAccount`
setting claims it, or else the only account whose capabilities include that
URN. A method set to `null`, or claimed by no capability, has none; so does
one whose URN no account lists. When several accounts list the URN and the
session names no primary, the default account is ambiguous and the Dispatcher
rejects the method call.
_Avoid_: primary mail account (a different, mail-specific account), fallback account
