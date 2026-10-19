# Getting Started

## Installation

::: code-group

```sh [npm]
npm add json-meta-client
```

```sh [pnpm]
pnpm add json-meta-client
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

## Usage

Configure a client with a bearer token, session URL, and capabilities
supported by the JMAP server.

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  bearerToken: "098b794a2f363189582614a13f47ea168852449da0eb51d6",
  sessionUrl: "https://api.example.com/.well-known/jmap",
  capabilities: ["mail", "submission"],
});
```

Issue a JMAP request:

```ts
const queryMailboxes = client.api.Mailbox.query({
  limit: 1,
  filter: {
    role: "inbox",
  },
});

const getEmails = client.api.Email.get({
  ids: mailboxQuery.ref("/ids"),
});
```
