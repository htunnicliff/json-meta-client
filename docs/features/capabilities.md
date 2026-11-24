# Capabilities

## What a capability is

In JMAP, a capability is a URN that names a set of features, such as
`urn:ietf:params:jmap:mail` for email. In json-meta-client, a capability is
that URN together with the entities it defines and the types of their
methods. Each capability you configure adds its entities to `client.api`,
with typed arguments and results.

## Enabling capabilities

Pass the capabilities your app needs in the `capabilities` option:

```ts
import { JsonMetaClient } from "json-meta-client";

const mailClient = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: "<token>",
  capabilities: ["mail", "submission", "vacationResponse"],
});
```

The built-in capabilities are configured by name:

| Name                      | URN                                        | Adds                                          |
| ------------------------- | ------------------------------------------ | --------------------------------------------- |
| `"mail"`                  | `urn:ietf:params:jmap:mail`                | `Mailbox`, `Thread`, `Email`, `SearchSnippet` |
| `"submission"`            | `urn:ietf:params:jmap:submission`          | `Identity`, `EmailSubmission`                 |
| `"vacationResponse"`      | `urn:ietf:params:jmap:vacationresponse`    | `VacationResponse`                            |
| `"mdn"`                   | `urn:ietf:params:jmap:mdn`                 | `MDN`                                         |
| `"smime"`                 | `urn:ietf:params:jmap:smimeverify`         | S/MIME properties on `Email`                  |
| `"blob"`                  | `urn:ietf:params:jmap:blob`                | More `Blob` methods                           |
| `"contacts"`              | `urn:ietf:params:jmap:contacts`            | `AddressBook`, `ContactCard`                  |
| `"quota"`                 | `urn:ietf:params:jmap:quota`               | `Quota`                                       |
| `"sharing"`               | `urn:ietf:params:jmap:principals`          | `Principal`, `ShareNotification`              |
| `"sieve"`                 | `urn:ietf:params:jmap:sieve`               | `SieveScript`                                 |
| `"community:maskedEmail"` | `https://www.fastmail.com/dev/maskedemail` | `MaskedEmail`                                 |

The [capabilities reference](../reference/capabilities.md) lists every
entity and method that each one adds.

`core` (`urn:ietf:params:jmap:core`) is always enabled, so `Core/echo`,
`Blob/copy`, and the `PushSubscription` methods are available on every
client without configuring anything.

Names are case-sensitive. An unknown name is a type error, and at runtime
the constructor throws
[`CapabilityConfigurationError`](../reference/errors.md).

You can mix built-in names with capabilities you define yourself with
[`defineCapability()`](../advanced/extending.md#defining-a-capability), by
passing the capability object in the same array.

### S/MIME

`"smime"` adds no methods of its own. It extends `mail`: with it, every
`Email` and `SearchSnippet` call also sends the S/MIME verification URN,
`Email/get` is typed with the `smime*` properties of RFC 9219, and
`Email/query` accepts the `hasSmime` and `hasVerifiedSmime` filter
conditions. A client without `"smime"` rejects those properties and
conditions at the type level.

Because it extends `mail`, `"smime"` requires it. Configuring `"smime"`
without `"mail"` makes the constructor throw `CapabilityConfigurationError`.

```ts
const smimeClient = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: "<token>",
  capabilities: ["mail", "smime"],
});

const signed = smimeClient.api.Email.query({
  filter: { hasVerifiedSmime: true },
});

void smimeClient.api.Email.get({
  ids: signed.resultRef("/ids"),
  properties: ["subject", "smimeStatus"],
});
```

## The `using` array

Every JMAP request lists the capabilities it uses in its `using` array. The
client builds it for you from the calls in each batch:

- It always includes `urn:ietf:params:jmap:core`.
- It adds the URN of every capability that declares an entity the batch
  calls. An entity declared by more than one configured capability adds all
  of their URNs: a `Blob` call on a client with `"blob"` sends both the core
  and blob URNs, and an `Email` call on a client with `"smime"` sends both
  the mail and S/MIME URNs.
- It adds the URNs a capability depends on. `MDN/send` updates emails, so
  `"mdn"` calls also send the mail URN.
- Each URN appears once, however many calls need it.

A batch of only `Mailbox` calls therefore sends
`["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"]`, even on a
client that also has `"submission"` configured.

## Checking server support

Servers differ in what they support. The first time the client loads the
session, it compares the configured capabilities with what the server
advertises. A configured URN found neither in `session.capabilities` nor in
any account's `accountCapabilities` is reported with `console.warn` and a
`ConfigurationError` that lists the missing URNs. This is only a warning: the
client keeps working, and calls that need a missing capability are rejected
by the server.

Either location counts because some servers advertise a capability only on
the accounts that can use it. Stalwart, for example, lists
`urn:stalwart:jmap` in `accountCapabilities` but not in the session's
`capabilities`.

## Reading capability details

Many capabilities come with details: limits and settings the server
publishes in the session. The client types them for each configured
capability:

- `session.capabilities[urn]` holds server-wide details.
- `session.accounts[accountId].accountCapabilities[urn]` holds the details
  for one account.

Both are `Partial`, because the server may not support a capability you
configured, or may support it only for some accounts. Check for `undefined`
before reading a value:

```ts
const session = await client.session;

const core =
  session.capabilities["urn:ietf:params:jmap:core"];
if (core) {
  console.log(
    `Uploads can be up to ${core.maxSizeUpload} bytes`,
  );
}

const mailAccountId =
  session.primaryAccounts["urn:ietf:params:jmap:mail"];
const mailDetails = mailAccountId
  ? session.accounts[mailAccountId]?.accountCapabilities[
      "urn:ietf:params:jmap:mail"
    ]
  : undefined;
if (mailDetails) {
  console.log(
    `Mailboxes can nest ${mailDetails.maxMailboxDepth ?? "any number of"} levels deep`,
  );
}
```

## Community capabilities

Names with the `community:` prefix are capabilities that aren't defined by
an IETF RFC. They come from a server vendor or community specification, and
their URN is often a URL rather than a `urn:ietf:params:jmap:` URN.

### Masked Email

`"community:maskedEmail"` supports
[Fastmail's Masked Email](https://www.fastmail.com/dev/maskedemail)
specification, `https://www.fastmail.com/dev/maskedemail`. A masked email is
a unique address that forwards to your inbox, which you can hand out to a
single website and turn off later.

It adds `MaskedEmail/get` and `MaskedEmail/set`. A `MaskedEmail` has these
properties:

| Property        | Type             | Description                                            |
| --------------- | ---------------- | ------------------------------------------------------ |
| `id`            | `string`         | The masked email's ID                                  |
| `email`         | `string`         | The address itself                                     |
| `state`         | `string`         | `"pending"`, `"enabled"`, `"disabled"`, or `"deleted"` |
| `forDomain`     | `string`         | The website the address is for                         |
| `description`   | `string`         | A note to help you recognize the address               |
| `lastMessageAt` | `string \| null` | When the address last received a message               |
| `createdAt`     | `string`         | When the address was created                           |
| `createdBy`     | `string`         | The client that created it                             |
| `url`           | `string \| null` | A URL related to the address                           |

When creating one, you can also pass `emailPrefix` to choose how the address
begins.

```ts
const fastmail = new JsonMetaClient({
  sessionUrl: "https://api.fastmail.com/jmap/session",
  auth: "<token>",
  capabilities: ["community:maskedEmail"],
});

const result = await fastmail.api.MaskedEmail.set({
  create: {
    shop: {
      state: "enabled",
      forDomain: "https://shop.example.com",
      description: "Online shop",
      emailPrefix: "shop",
    },
  },
});

console.log(result.created?.shop?.email);
```
