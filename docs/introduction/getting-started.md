# Getting Started

JSON Meta Client lets you call JMAP methods from TypeScript or JavaScript. This guide uses the `mail` capability to fetch email subjects.

## Before You Start

You’ll need a JMAP provider that supports mail, its session URL, and a bearer token with permission to read mail. Your provider’s documentation explains how to obtain them. Some providers expose the session at `https://your-provider.example/.well-known/jmap`.

The client uses Web APIs including `fetch`, `Request`, `Response`, `URL.canParse()`, `crypto.randomUUID()`, and `Promise.withResolvers()`. Use a current runtime that provides these APIs, such as Node.js 24 or a current browser. Browser requests also require your provider to allow cross-origin access.

Keep bearer tokens private. For a browser application, use an authentication flow supported by your provider; do not bundle a personal token into public assets.

## Installation

::: code-group

```sh [npm]
npm install json-meta-client
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
deno add npm:json-meta-client
```

:::

## Create a Client

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  bearerToken: "<bearer-token>",
  sessionUrl: "https://your-provider.example/.well-known/jmap",
  capabilities: ["mail"],
});
```

Replace the token and URL with your provider’s values. The `mail` capability adds typed methods for emails, mailboxes, threads, and search snippets. See [Capabilities](../features/capabilities.md) for other options.

Creating a client does not send a request. The client loads the session when it first needs it, then caches it.

## Fetch Emails

```ts
const query = client.api.Email.query({ limit: 10 });
const get = client.api.Email.get({
  ids: query.ref("/ids"),
  properties: ["subject", "from"],
});
const [, emails] = await Promise.all([query, get]);

for (const email of emails.list) {
  console.log(email.subject, email.from);
}
```

`Email/query` finds email IDs. `Email/get` fetches the selected properties for those IDs. Creating both calls before awaiting them lets the client send both calls in one request. The server substitutes the query’s IDs into the get call using a [result reference](../features/result-references.md).

For independent calls, you can await each method directly:

```ts
const mailboxes = await client.api.Mailbox.get({});
console.log(mailboxes.list);
```

## Session and Accounts

By default, method calls use the session’s primary **mail** account. To use another account, pass `accountId` in the method arguments:

```ts
const session = await client.session;
console.log(session.accounts);

const mailboxes = await client.api.Mailbox.get({
  accountId: "<account-id>",
});
```

For capabilities such as contacts, explicitly select an account that supports the capability. The default is still the mail account, regardless of the entity being called.

Use `await client.refreshSession()` to retrieve and cache a fresh session. If the initial session load fails, call `refreshSession()` to retry it.

## Next Steps

- Try the [Examples](./examples.md).
- Learn how [Method Calls](../features/method-calls.md) and [Batching](../features/batching.md) work.
- Read about [Errors](../reference/errors.md) before adding failure handling.
