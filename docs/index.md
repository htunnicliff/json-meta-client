# Introduction

:::warning IN PROGRESS
These docs are not yet complete.
:::

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
deno add json-meta-client
```
:::

Or install it using a module script:

<script setup>
import {data as pkg} from './pkg.data.ts'
</script>

::: code-group

```html-vue [Script ~vscode-icons:file-type-html~]
<script type="module">
  import { JsonMetaClient } from "https://unpkg.com/json-meta-client@{{ pkg.version }}/dist/index.mjs";
</script>
```

```html-vue [Import Map ~vscode-icons:file-type-html~]
<html>
  <head>
    <script type="importmap">
      {
        "imports": {
          "json-meta-client": "https://unpkg.com/json-meta-client@{{ pkg.version }}/dist/index.mjs",
        }
      }
    </script>
  </head>
  <body>
    <script type="module">
      import { JsonMetaClient } from "json-meta-client";
    </script>
  </body>
</html>
```

:::

## Configuration

Configure a client with a bearer token, session URL, and capabilities:

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  bearerToken: "<token>",
  sessionUrl: "<server>/.well-known/jmap",
  capabilities: ["mail", "submission"],
});
```

## Usage

Find the inbox:

::: code-group

```ts [example.ts]
const queryMailboxes = await client.api.Mailbox.query({
  filter: { role: "inbox" },
  limit: 1,
});

const [inboxId] = queryMailboxes.list;
```

```json [request.json]
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
        "limit": 1,
        "accountId": "*********"
      },
      "Mailbox/query::e64dc905"
    ]
  ]
}
```

:::

Make an [async iterator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function*) for emails in the inbox:

::: code-group

```ts [example.ts]
async function* getEmails(limit = 10) {
  let anchor: string | undefined;

  do {
    const queryEmails = client.api.Email.query({
      filter: { inMailbox: inboxId },
      anchor,
      limit,
      anchorOffset: 1,
    });

    const getEmails = await client.api.Email.get({
      ids: queryEmails.ref("/ids"),
      properties: ["id", "to", "from", "subject", "sentAt"],
    });

    for (const email of getEmails.list) {
      yield email;
    }

    anchor = getEmails.list.at(-1)?.id;
  } while (anchor);
}
```

```json [request.json]
{
  "using": [
    "urn:ietf:params:jmap:core",
    "urn:ietf:params:jmap:mail"
  ],
  "methodCalls": [
    [
      "Email/query",
      {
        "filter": { "inMailbox": "P-F" },
        "limit": 10,
        "anchorOffset": 1,
        "anchor": "<last-email-id>",
        "accountId": "*********"
      },
      "Email/query::d1ca7ea5"
    ],
    [
      "Email/get",
      {
        "#ids": {
          "name": "Email/query",
          "resultOf": "Email/query::68ed8b27",
          "path": "/ids"
        },
        "properties": [
          "id",
          "to",
          "from",
          "subject",
          "sentAt",
          "keywords"
        ],
        "accountId": "*********"
      },
      "Email/get::a4f7a29b"
    ]
  ]
}
```

:::

Iterate through every email in the inbox:

```ts
for await (const email of getEmails()) {
  const { id, from, to, subject, sentAt, keywords } = email;

  console.log({
    id,
    from,
    to,
    subject,
    sentAt,
    keywords,
  })
}
```

## Next Steps

| I want to...                            | Read                                       |
| --------------------------------------- | ------------------------------------------ |
| Make JMAP requests                      | [Method Calls](./features/method-calls.md) |
| Listen for state changes                | [Events](./features/events.md)             |
| Upload and download files               | [Blobs](./features/blobs.md)               |
| Do things the _right way™_              | [Best Practices](./best-practices.md)      |
| Test with this library                  | [Testing](./testing.md)                    |
| Understand the API                      | [API](./reference/api.md)                  |
| Handle failures                         | [Errors](./reference/errors.md)            |
| Understand how method calls are batched | [Batching](./advanced/batching.md)         |
| Define custom capabilities              | [Extending](./advanced/extending.md)       |
| Hook into the request lifecycle         | [Hooks](./advanced/hooks.md)               |
