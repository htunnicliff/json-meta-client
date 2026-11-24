# RFCs

The client implements these JMAP specifications. **Types** means the
specification's objects, method arguments and capability details are typed.
**Runtime** means the client can call the specification's methods once the
listed capability is enabled. Refer to the
[capabilities reference](./capabilities.md) for each capability's methods.

| Standard                                             | Title                                     | Capability                                                                                                                               | Types | Runtime |
| ---------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------- |
| [RFC 8620](https://www.rfc-editor.org/info/rfc8620/) | The JSON Meta Application Protocol (JMAP) | [`core`](./capabilities.md#default-capability) (always on)                                                                               | ✅    | ✅      |
| [RFC 8621](https://www.rfc-editor.org/info/rfc8621/) | JMAP for Mail                             | [`mail`](./capabilities.md#mail), [`submission`](./capabilities.md#submission), [`vacationResponse`](./capabilities.md#vacationResponse) | ✅    | ✅      |
| [RFC 9007](https://www.rfc-editor.org/info/rfc9007/) | JMAP MDN                                  | [`mdn`](./capabilities.md#mdn)                                                                                                           | ✅    | ✅      |
| [RFC 9219](https://www.rfc-editor.org/info/rfc9219/) | JMAP S/MIME Signature Verification        | [`smime`](./capabilities.md#smime)                                                                                                       | ✅    | ✅      |
| [RFC 9404](https://www.rfc-editor.org/info/rfc9404/) | JMAP for Blob Management                  | [`blob`](./capabilities.md#blob)                                                                                                         | ✅    | ✅      |
| [RFC 9425](https://www.rfc-editor.org/info/rfc9425/) | JMAP for Quotas                           | [`quota`](./capabilities.md#quota)                                                                                                       | ✅    | ✅      |
| [RFC 9553](https://www.rfc-editor.org/info/rfc9553/) | JSContact                                 | [`contacts`](./capabilities.md#contacts) (data format of `ContactCard`)                                                                  | ✅    | ✅      |
| [RFC 9610](https://www.rfc-editor.org/info/rfc9610/) | JMAP for Contacts                         | [`contacts`](./capabilities.md#contacts)                                                                                                 | ✅    | ✅      |
| [RFC 9661](https://www.rfc-editor.org/info/rfc9661/) | JMAP for Sieve Scripts                    | [`sieve`](./capabilities.md#sieve)                                                                                                       | ✅    | ✅      |
| [RFC 9670](https://www.rfc-editor.org/info/rfc9670/) | JMAP for Sharing                          | [`sharing`](./capabilities.md#sharing)                                                                                                   | ✅    | ✅      |
| [RFC 9749](https://www.rfc-editor.org/info/rfc9749/) | JMAP VAPID                                | None (see [note](#note-about-vapid))                                                                                                     | ✅    | ❌      |
| [RFC 8887](https://www.rfc-editor.org/info/rfc8887/) | JMAP Subprotocol for WebSocket            | None (see [note](#note-about-websocket-support))                                                                                         | ✅    | ❌      |

## Note About VAPID

RFC 9749 defines no methods. It adds a server-wide capability,
`urn:ietf:params:jmap:webpush-vapid`, whose `applicationServerKey` a client
passes to its push service when it creates a `PushSubscription`. The library
types that capability on every session, so there is nothing to enable:

```ts
const session = await client.session;
const vapid =
  session.capabilities[
    "urn:ietf:params:jmap:webpush-vapid"
  ];

if (vapid) {
  console.log(vapid.applicationServerKey);
}
```

Creating the subscription itself uses `PushSubscription/set` from `core`.

## Note About WebSocket Support

RFC 8887's session capability, `urn:ietf:params:jmap:websocket`, is typed on
every session, but the client sends every JMAP Request over HTTP and does not
open WebSocket connections. At this time, WebSocket support is not planned.
For push notifications, use [`onStateChange()`](./api.md#onstatechange), which
reads the server's event source.
