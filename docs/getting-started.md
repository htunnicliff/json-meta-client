# Introduction

Thanks for trying out this library! I hope it makes your experience
working with JMAP intuitive, straightforward, and possibly even a little
bit fun.

This Getting Started guide walks you through a few basic steps to
install the library, configure it, and then use it to begin working with JMAP.

::: note

If you are unfamiliar with the JSON meta application protocol (JMAP)
standard, no worries. The library is fully typed and has a fairly smooth
learning curve.

If you want to learn more about the underlying standards, the [JMAP.io](https://jmap.io/)
website is a great place to dive in.

:::

## Requirements

To use this library, you'll need an environment that supports [modern JavaScript
features](https://web-platform-dx.github.io/baseline/).

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

Or install it using a module script:

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

To begin, initialize an instance of `JsonMetaClient` with a session URL,
credentials, and capabilities:

::: code-group

<<< @/snippets/auth-bearer.ts [Bearer Auth]

<<< @/snippets/auth-basic.ts [Basic Auth]

<<< @/snippets/auth-custom.ts [Custom Auth]

:::

The `capabilities` value determines which entities and methods your client
can use. These vary depending on the JMAP server. Review the
[capabilities guide](./features/capabilities.md) to learn more.

The `sessionUrl` is used to procure a session from your provider. These
sometimes use the path `/.well-known/jmap`.

The `auth` value is used to authenticate all requests sent by a client. It
supports several strategies: bearer auth, basic auth, or custom, which is a
callback to modify each [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request)
instance. See the [auth API reference](./reference/api.md#auth) to learn more.

To learn more about these and other options, review the
[configuration types](./reference/api.md#config) in the API reference guide.

## Usage

With a client configured, you can now make requests. Here is a simple example:

```ts
await client.api.Mailbox.query({
  filter: { role: "inbox" },
});
```

This function call results in the following JMAP request:

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
      "mailboxes"
    ]
  ]
}
```

::: tip
For convenience, the client will automatically set the `accountId` based on the primary account associated with the URNs used in a request.
:::

To use the result of one method call as a parameter in a different method call,
you may use a [result reference](./features/method-calls.md#result-references):

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

:::tip
_Result references_ enable the passing of values between requests without requiring
additional HTTP request round trips.
:::

This is the resulting JMAP request:

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
      "query"
    ],
    [
      "Email/get",
      {
        "#ids": {
          "name": "Email/query",
          "resultOf": "query",
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
      "emails"
    ]
  ]
}
```

To fetch new emails as soon as they are received, use the `onStateChange`
handler:

```ts
client.onStateChange(async (error, stateChange) => {
  if (error) {
    throw new Error("Something went awry", {
      cause: error,
    });
  }

  const { entity, state } = stateChange;

  if (entity === "Email") {
    const changes = client.api.Email.changes({
      sinceState: state,
    });

    await client.api.Email.get({
      ids: changes.resultRef("/created"),
    });
  }
});
```

You can also upload and download files:

```ts
const emails = await client.api.Email.get({
  ids: ["<emailId>"],
  properties: ["id", "attachments"],
});

const email = emails.list[0]!;

const { blobId, type, name } = email.attachments[0]!;

const request = await client.blob.download({
  accountId: "<accountId>",
  blobId: blobId!,
  type: type!,
  name: name!,
});

const data = await request.json();
//           await request.blob();
//           await request.arrayBuffer();
//           etc.
```

Great work!

## Next Steps

| I want to...                            | Read                                       |
| --------------------------------------- | ------------------------------------------ |
| Make JMAP requests                      | [Method Calls](./features/method-calls.md) |
| Listen for state changes                | [Events](./features/events.md)             |
| Upload and download files               | [Blobs](./features/blobs.md)               |
| Test with this library                  | [Testing](./testing.md)                    |
| Understand the API                      | [API](./reference/api.md)                  |
| Handle failures                         | [Errors](./reference/errors.md)            |
| Understand how method calls are batched | [Batching](./advanced/batching.md)         |
| Define custom capabilities              | [Extending](./advanced/extending.md)       |
| Hook into the request lifecycle         | [Hooks](./advanced/hooks.md)               |
