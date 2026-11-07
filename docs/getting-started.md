# Introduction

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
import { data as pkg } from './pkg.data.ts'

const { version } = pkg;
const installPath = pkg.exports['.'].replace('./', '');
const cdnUrl = `https://unpkg.com/json-meta-client@${version}/${installPath}`;
</script>

::: code-group

```html-vue [Script ~vscode-icons:file-type-html~]
<script type="module">
  import { JsonMetaClient } from "{{cdnUrl}}";
</script>
```

```html-vue [Import Map ~vscode-icons:file-type-light-json~]
<html>
  <head>
    <script type="importmap">
      {
        "imports": {
          "json-meta-client": "{{cdnUrl}}",
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

Configure a client with authentication, a session URL, and capabilities:

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  auth: { token: "<token>" },
  sessionUrl: "<server>/.well-known/jmap",
  capabilities: ["mail", "submission"],
});
```

Clients support both Bearer and Basic authentication schemes.

For other kinds of authentication (e.g. a proxy header), a custom callback can
be used to modify fetch requests as needed. See
[Authentication](./features/authentication.md) for more examples.

## Usage

Find the inbox:

::: code-group

```ts [example.ts]
const mailboxes = await client.api.Mailbox.query({
  filter: { role: "inbox" },
  limit: 1,
});

const [inboxId] = mailboxes.list;
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
        "accountId": "<accountId>"
      },
      "Mailbox/query::e64dc905"
    ]
  ]
}
```

:::

Get the first ten unread emails in the inbox:

::: code-group

```ts [example.ts]
const query = client.api.Email.query({
  filter: { inMailbox: inboxId },
  limit: 10,
});

const emails = await client.api.Email.get({
  ids: query.resultRef("/ids"),
  properties: ["id", "to", "from", "subject", "sentAt"],
});

for (const email of emails.list) {
  // ...
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
        "filter": { "inMailbox": "<inboxId>" },
        "limit": 10,
        "accountId": "<accountId>"
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
          "sentAt"
        ],
        "accountId": "<accountId>"
      },
      "Email/get::a4f7a29b"
    ]
  ]
}
```

:::

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
