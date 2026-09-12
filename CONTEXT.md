# JMAP Client

This context describes the protocol concepts exposed by a client that communicates with a JMAP server.

## Communication

**HTTP transport**:
The RFC 8620 request-response channel used to exchange JMAP method calls and responses over HTTP.

**WebSocket transport**:
The RFC 8887 bidirectional channel used to exchange JMAP method calls, responses, request errors, and optional state-change notifications.
_Avoid_: Socket transport

**WebSocket push**:
The optional RFC 8887 flow in which a server sends state-change notifications over the current WebSocket connection after the client enables them.
_Avoid_: Push subscription, Event Source

## State Synchronization

**State Change**:
A notification that identifies the current state of changed JMAP data types for one or more accounts. It is a synchronization hint, not the changed data itself.

**Type State**:
An opaque value representing the current state of one JMAP data type in one account.

**Push State**:
An opaque value representing the complete server state visible to a user, which can be used to resume WebSocket push after reconnecting.
_Avoid_: Type State
