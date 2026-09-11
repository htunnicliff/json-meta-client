# json-meta-client

> [!WARNING]
> This library is alpha software.

## Overview

A [JMAP][jmap] client compatible with Node.js and the browser.

### Standards

#### Implemented

- [`RFC 8620`][rfc8620] - JMAP
- [`RFC 8621`][rfc8621] - JMAP for Mail

#### Planned

- [`RFC 9749`][rfc9749] - VAPID for JMAP Push
- [`RFC 9670`][rfc9670] - JMAP Sharing
- [`RFC 8887`][rfc8887] - JMAP Subprotocol for WebSocket
- [`RFC 9425`][rfc9425] - JMAP Quotas
- [`RFC 9404`][rfc9404] - JMAP Blob Management
- [`RFC 9661`][rfc9661] - JMAP Sieve Scripts Management
- [`RFC 9007`][rfc9007] - JMAP MDN Handling
- [`RFC 9219`][rfc9219] - JMAP S/MIME Signature Verification

## Installation

```sh
pnpm add json-meta-client
```

## Usage

Create a client:

```ts
import { Client } from "json-meta-client";

const client = new Client({
  bearerToken: "<token>",
  sessionUrl: "<session-url>",
});
```

Issue a single JMAP request:

<table>
<thead>
<tr>
  <th>Code</th>
  <th>Resulting JMAP Request</th>
</tr>
</thead>
<tbody>
<tr>
<td>

```ts
const response = await client.api.Mailbox.query({
  filter: { role: "inbox" },
  limit: 1,
});

const [inboxId] = response.ids;
```

</td>
<td>

```json
{
  "using": [
    "urn:ietf:params:jmap:core",
    "urn:ietf:params:jmap:mail"
  ],
  "methodCalls": [
    [
      "Mailbox/query",
      {
        "accountId": "<primary-account-id>",
        "filter": { "role": "inbox" },
        "limit": 1
      },
      "<opaque id>"
    ]
  ]
}
```

</td>
</tr>
</tbody>
</table>

Issue a _batch_ of JMAP requests to take advantage of result references[^1]:

<table>
<thead>
<tr>
  <th>Code</th>
  <th>Resulting JMAP Request</th>
</tr>
</thead>
<tbody>
<tr>
<td>

```ts
import { ref } from "json-meta-client";

// Note the lack of `await` here:
const emailsQuery = client.api.Email.query({
  inMailbox: inboxId,
  limit: 10,
});

const emails = await client.api.Email.get({
  ids: ref(emailsQuery, "/ids"),
});
```

</td>
<td>

```json
{
  "using": [
    "urn:ietf:params:jmap:core",
    "urn:ietf:params:jmap:mail"
  ],
  "methodCalls": [
    [
      "Email/query",
      {
        "accountId": "<primary-account-id>",
        "inMailbox": "<inbox-id>",
        "limit": 10
      },
      "<opaque id #1>"
    ],
    [
      "Email/get",
      {
        "accountId": "<primary-account-id>",
        "#ids": {
          "name": "Email/query",
          "resultOf": "<opaque id #1>",
          "path": "/ids"
        }
      },
      "<opaque id #2>"
    ]
  ]
}
```

</td>
</tr>
</tbody>
</table>

## Capabilities

The following capabilities are built-in and come with full TypeScript support:

| URN                                     | Entities                                      |
| --------------------------------------- | --------------------------------------------- |
| `urn:ietf:params:jmap:core`             | `Blob`, `Core`, `PushSubscription`            |
| `urn:ietf:params:jmap:mail`             | `Email`, `Mailbox`, `Thread`, `SearchSnippet` |
| `urn:ietf:params:jmap:submission`       | `EmailSubmission` ,`Identity`                 |
| `urn:ietf:params:jmap:vacationresponse` | `VacationResponse`                            |

## Architecture

### Proxies for Method Calls

> TODO: Discuss the use of a Proxy for determining method calls

### Deferred Request Batching

> TODO: Discuss the use of [batcher][batcher] for grouping requests via promise mechanics

[^1]: [RFC 8620 § 3.7 - References to Previous Method Results](https://jmap.io/spec/rfc8620/#section-3.7)

[jmap]: https://jmap.io/
[rfc8620]: https://jmap.io/spec/rfc8620/
[rfc8621]: https://jmap.io/spec/rfc8621/
[rfc8887]: https://jmap.io/spec/rfc8887/
[rfc9007]: https://jmap.io/spec/rfc9007/
[rfc9219]: https://jmap.io/spec/rfc9219/
[rfc9404]: https://jmap.io/spec/rfc9404/
[rfc9425]: https://jmap.io/spec/rfc9425/
[rfc9661]: https://jmap.io/spec/rfc9661/
[rfc9670]: https://jmap.io/spec/rfc9670/
[rfc9749]: https://jmap.io/spec/rfc9749/
[batcher]: ./src/internal/batcher.ts
