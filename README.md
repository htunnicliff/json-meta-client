# json-meta-client

> [!WARNING]
> This library is alpha software.

## Overview

A [JMAP][jmap] client compatible with Node.js and the browser.

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

#### Issue a single JMAP request

```ts
const response = await client.api.Mailbox.query({
  filter: { role: "inbox" },
  limit: 1,
});

const [inboxId] = response.ids;
```

<details>
<summary>View JMAP request</summary>

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

</details>

#### Issue a _batch_ of JMAP requests

This takes advantage of result references[^1]

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

<details>
<summary>View JMAP request</summary>

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

</details>

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
[rfc9610]: https://jmap.io/spec/rfc9610/
[rfc9661]: https://jmap.io/spec/rfc9661/
[rfc9670]: https://jmap.io/spec/rfc9670/
[rfc9749]: https://jmap.io/spec/rfc9749/
[batcher]: ./src/internal/batcher.ts
