# Capabilities

A JMAP capability identifies a protocol extension by a URN or URL.
The session advertises server capabilities and each account's
supported capabilities. The client configuration associates those
identifiers with entities and TypeScript method contracts.
A call's entity determines which configured capabilities appear in
the request's `using` array. When several configured capabilities
provide an entity, all their identifiers are included. Core is
always included.

```ts
import { Client } from "json-meta-client";
import { mail, submission, vacationResponse } from "json-meta-client/capabilities";

const client = new Client({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  bearerToken: "<token>",
  capabilities: [mail, submission, vacationResponse],
});
const identities = await client.api.Identity.get({});
```

Choose capabilities your service and account support. Adding a
capability changes the available client method types and request
`using` values; the server still controls access and availability.
The initial session check warns about configured identifiers the
server does not advertise. It does not negotiate replacements.

## Built-in exports

Import these from `json-meta-client/capabilities`:

| Export             | Identifier                              | Entities                              | Typing                     |
| ------------------ | --------------------------------------- | ------------------------------------- | -------------------------- |
| `core`             | `urn:ietf:params:jmap:core`             | Core, Blob, PushSubscription          | Typed; included by default |
| `mail`             | `urn:ietf:params:jmap:mail`             | Mailbox, Thread, Email, SearchSnippet | Typed                      |
| `submission`       | `urn:ietf:params:jmap:submission`       | Identity, EmailSubmission             | Typed                      |
| `vacationResponse` | `urn:ietf:params:jmap:vacationresponse` | VacationResponse                      | Typed                      |
| `blob`             | `urn:ietf:params:jmap:blob`             | Blob                                  | Partially typed            |
| `contacts`         | `urn:ietf:params:jmap:contacts`         | AddressBook, ContactCard              | Partially typed            |
| `sieve`            | `urn:ietf:params:jmap:sieve`            | SieveScript                           | Partially typed            |

Core exposes the account-free `Core.echo` identity method, along
with blob copy and push subscription methods. For example,
`await client.api.Core.echo({ greeting: "hello" })` returns the same
JSON object from the server.

The partially typed capabilities contain permissive `any` contracts;
inspect server documentation and validate responses where needed.
The blob extension's `Blob/upload` method differs from
`client.blob.upload()`, which posts bytes to the session upload URL.
The mail and submission protocols are described by
[RFC 8621](https://www.rfc-editor.org/rfc/rfc8621.html).

## Community exports

Import `maskedEmail` from
`json-meta-client/capabilities/community`. It exposes typed
`MaskedEmail/get` and `MaskedEmail/set` for the
`https://www.fastmail.com/dev/maskedemail` capability. Community
capabilities are provider extensions rather than standard features
of every JMAP server. Their URNs must be advertised by your service.

For your own extension, see [custom capability authoring](custom-capabilities.md).
For precise argument and result inference, see
[method contracts](method-contracts.md).
