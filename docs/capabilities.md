# Capabilities

A capability identifies a JMAP feature by a URN or URL. The session
document lists the server's capabilities and the capabilities available
to each account. Configure the client with the features you intend to use.
Each preset associates a capability identifier with entity names and
TypeScript method contracts.

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

Here, `submission` makes `Identity.get` available alongside mail methods.
Adding a capability changes method types and the request's `using` array;
access still depends on the server and account. The client warns if the
initial session omits a configured capability and keeps your configuration.

Each request includes Core and the identifiers of all configured capabilities
that provide its called entities. If two capabilities provide one entity,
both identifiers are included, regardless of which method is called.

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

Core exposes `Core.echo`, which returns its arguments without requiring
an account, along with blob copy and push subscription methods. For example,
`await client.api.Core.echo({ greeting: "hello" })` returns the same
JSON object from the server.

Partially typed presets use `any` for some contracts. Consult the server's
protocol documentation and validate those responses in your application.
The blob extension's `Blob/upload` method differs from
`client.blob.upload()`, which posts bytes to the session upload URL.
The mail and submission protocols are described by
[RFC 8621](https://www.rfc-editor.org/rfc/rfc8621.html).

## Community exports

Import `maskedEmail` from
`json-meta-client/capabilities/community`. It exposes typed
`MaskedEmail/get` and `MaskedEmail/set` for the
`https://www.fastmail.com/dev/maskedemail` capability. Your service must advertise this identifier to use it. Community
capabilities describe provider extensions, so availability varies by service.

For your own extension, see [custom capability authoring](custom-capabilities.md).
For precise argument and result inference, see
[method contracts](method-contracts.md).
