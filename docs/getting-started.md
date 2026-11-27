# Introduction

Thanks for trying out this library! I hope it makes your experience
working with JMAP intuitive, straightforward, and possibly even a little
bit fun.

This Getting Started guide walks you through a few basic steps to
install the library, configure it, and then use it to begin working with JMAP.

::: note

If you are new to the JSON Meta Application Protocol (JMAP), no worries.
The library is fully typed, so your editor can guide you through each method
and its arguments.

To learn more about the underlying standards, [JMAP.io](https://jmap.io/) is
a great place to start.

:::

## Requirements

- **Node.js 22 or later**, or a current release of Deno, Bun, or a modern
  browser. The package is published as ES2023 modules and relies on the
  global `fetch`, `AbortController`, and `URL` APIs.
- **TypeScript 5.4 or later**, if you use TypeScript.

## Installation

Install the library using a package manager:

::: code-group

```sh [pnpm]
pnpm add json-meta-client
```

```sh [npm]
npm add json-meta-client
```

```sh [yarn]
yarn add json-meta-client
```

```sh [bun]
bun add json-meta-client
```

```sh [deno]
deno add npm:json-meta-client
```
:::

Or import it in a module script from a CDN:

<script setup>
import { data as pkg } from './pkg.data.ts'

const { version } = pkg;
const installPath = pkg.exports['.'].replace('./', '');
const cdnUrl = `https://unpkg.com/json-meta-client@${version}/${installPath}`;
</script>

```html-vue [index.html]
<script type="module">
  import { JsonMetaClient } from "{{cdnUrl}}";
</script>
```

## Setup

To begin, create a `JsonMetaClient` with a session URL, credentials, and
capabilities:

::: code-group

<<< @/snippets/auth-bearer.ts [Bearer Auth]

<<< @/snippets/auth-basic.ts [Basic Auth]

<<< @/snippets/auth-custom.ts [Custom Auth]

:::

`sessionUrl` is where the client fetches the JMAP session, which describes
the server, its accounts, and its capabilities. Many servers publish it at
`/.well-known/jmap`.

`auth` authenticates every request the client sends. It takes a bearer
token, a username and password for Basic authentication, or a callback that
changes each outgoing
[`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request). Refer
to the [`auth` reference](./reference/api.md#auth) to learn more.

`capabilities` determines which entities and methods your client can use.
Servers differ in what they support, so list the ones your app needs. Refer
to the [capabilities guide](./features/capabilities.md) to learn more.

For these and the other options, refer to [`Config`](./reference/api.md#config)
in the API reference.

## Usage

With a client configured, you can call methods on `client.api`:

```ts
await client.api.Mailbox.query({
  filter: { role: "inbox" },
});
```

This call sends the following JMAP request:

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
        "filter": { "role": "inbox" },
        "accountId": "<account-id>"
      },
      "Mailbox/query::1a2b3c4d"
    ]
  ]
}
```

::: tip
The client fills in `accountId` for you, usually with the server's primary
account for the capability that owns the method. Refer to
[Account IDs](./features/method-calls.md#account-ids) for the details.
:::

To pass the result of one method call into another, use a
[result reference](./features/method-calls.md#result-references):

```ts
const query = client.api.Email.query({
  filter: { inMailbox: "<inboxId>" },
  limit: 10,
});

await client.api.Email.get({
  ids: query.resultRef("/ids"),
  properties: ["id", "to", "from", "subject", "sentAt"],
});
```

Both calls go out in one JMAP request, and the server passes the query's IDs
to `Email/get` without another round trip:

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
        "filter": { "inMailbox": "<inboxId>" },
        "limit": 10,
        "accountId": "<account-id>"
      },
      "Email/query::5e6f7a8b"
    ],
    [
      "Email/get",
      {
        "#ids": {
          "name": "Email/query",
          "resultOf": "Email/query::5e6f7a8b",
          "path": "/ids"
        },
        "properties": [
          "id",
          "to",
          "from",
          "subject",
          "sentAt"
        ],
        "accountId": "<account-id>"
      },
      "Email/get::9c0d1e2f"
    ]
  ]
}
```

To fetch new emails as they arrive, subscribe with `onStateChange()`. A
state change says only that the server's state moved on, so keep the last
state you've seen and ask `Email/changes` what happened since then:

```ts
let emailState = (await client.api.Email.get({ ids: [] }))
  .state;

await client.onStateChange(async (error, change) => {
  if (error) {
    console.error(error);
    return;
  }

  if (
    change.entity === "Email" &&
    change.isPrimaryAccount
  ) {
    const changes = client.api.Email.changes({
      sinceState: emailState,
    });
    emailState = change.state;

    const created = await client.api.Email.get({
      ids: changes.resultRef("/created"),
      properties: ["subject"],
    });
    for (const { subject } of created.list) {
      console.log("New email:", subject);
    }
  }
});
```

You can also upload and download files. A blob transfer names its account,
so read the mail account from the session:

```ts
const session = await client.session;
const mailAccountId =
  session.primaryAccounts["urn:ietf:params:jmap:mail"]!;

const withAttachments = await client.api.Email.get({
  ids: ["<emailId>"],
  properties: ["attachments"],
});

const { blobId, type, name } =
  withAttachments.list[0]!.attachments[0]!;

const response = await client.blob.download({
  accountId: mailAccountId,
  blobId: blobId!,
  type,
  name: name ?? "attachment",
});

const file = await response.blob();
// or: response.text(), response.arrayBuffer(), response.body
```

## Next Steps

| I want to...                            | Read                                       |
| --------------------------------------- | ------------------------------------------ |
| Make JMAP requests                      | [Method Calls](./features/method-calls.md) |
| Choose capabilities                     | [Capabilities](./features/capabilities.md) |
| Listen for state changes                | [Events](./features/events.md)             |
| Upload and download files               | [Blobs](./features/blobs.md)               |
| See complete examples                   | [Examples](./examples.md)                  |
| Test with this library                  | [Testing](./testing.md)                    |
| Understand the API                      | [API](./reference/api.md)                  |
| Handle failures                         | [Errors](./reference/errors.md)            |
| Understand how method calls are batched | [Batching](./advanced/batching.md)         |
| Hook into the request lifecycle         | [Hooks](./advanced/hooks.md)               |
| Use WebSockets                          | [Transports](./advanced/transports.md)     |
| Define custom capabilities              | [Extending](./advanced/extending.md)       |
