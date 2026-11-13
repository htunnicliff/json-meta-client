# Introduction

## Requirements

To use `json-meta-client`, you'll need an environment that supports ES modules, `fetch`, `Promise.withResolvers`, `URL.canParse`, and `Object.hasOwn`.

If your environment meets [Baseline](https://web-platform-dx.github.io/baseline/),
you are all set! Runtimes that meet that standard include:

- Node (22+)
- Deno
- Bun
- Browsers released after 2024

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

::: code-group

```html-vue [Script ~vscode-icons:file-type-html~]
<script type="module">
  import { JsonMetaClient } from "{{cdnUrl}}";
</script>
```

```html-vue [Import Map ~vscode-icons:file-type-xml~]
<html>
  <head>
    <script type="importmap">
      {
        "imports": {
          "json-meta-client": "{{cdnUrl}}"
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

<!--
- Short table of all `Config` fields: `auth`, `sessionUrl` (string or `URL`),
  `capabilities`, `hooks`
- `core` is always included, so empty capabilities still give `Core.echo`,
  `Blob.copy`, and `PushSubscription`
- Constructor validates config immediately and throws `ConfigurationError` /
  `CapabilityConfigurationError` (link to Errors)
- The client object is frozen
-->

Configure a client with authentication, a session URL, and capabilities:

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  auth: "<token>",
  sessionUrl: "<server>/.well-known/jmap",
  capabilities: ["mail", "submission"],
});
```

Pass a string as `auth` to send it as a Bearer token. Clients also support Basic
authentication with `auth: { username, password }`.

For other kinds of authentication (e.g. a proxy header), a custom callback can
be used to modify fetch requests as needed. See
[Authentication](./reference/api.md#authentication) for more examples.

## Usage

:::warning TODO
- Add a sentence explaining that `accountId` was filled in automatically
:::

Find the inbox:

::: code-group

```ts [example.ts]
const mailboxes = await client.api.Mailbox.query({
  filter: { role: "inbox" },
  limit: 1,
});

const inboxId = mailboxes.ids[0]!;
```

```json [JMAP Request ~vscode-icons:file-type-light-json~] {jmap:generated}
{
  "using": [
    "urn:ietf:params:jmap:core",
    "urn:ietf:params:jmap:mail"
  ],
  "methodCalls": [
    [
      "Mailbox/query",
      {
        "filter": {
          "role": "inbox"
        },
        "limit": 1,
        "accountId": "<account-id>"
      },
      "Mailbox/query::c9f3fdeb"
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

```json [JMAP Request ~vscode-icons:file-type-light-json~] {jmap:generated}
{
  "using": [
    "urn:ietf:params:jmap:core",
    "urn:ietf:params:jmap:mail"
  ],
  "methodCalls": [
    [
      "Email/query",
      {
        "filter": {
          "inMailbox": "<inboxId>"
        },
        "limit": 10,
        "accountId": "<account-id>"
      },
      "Email/query::c9f3fdeb"
    ],
    [
      "Email/get",
      {
        "#ids": {
          "name": "Email/query",
          "resultOf": "Email/query::c9f3fdeb",
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
      "Email/get::16cac814"
    ]
  ]
}
```

:::

## Next Steps

:::warning TODO
- Add rows for Capabilities and Types
:::

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
