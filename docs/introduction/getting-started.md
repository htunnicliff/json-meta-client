# Getting started

This guide connects a client to a JMAP mail account and reads a few message subjects.

## Prepare your runtime and credentials

Use a runtime with `fetch`, `Request`, `Response`, `URL.canParse()`, `crypto.randomUUID()`, and `Promise.withResolvers()`. Node.js 24 and current browsers provide these APIs.

Ask your provider for:

- Its JMAP session URL. Some providers use `https://your-provider.example/.well-known/jmap`.
- A bearer token authorized to read your mail.
- Confirmation that it supports the JMAP mail capability.

For browser applications, the provider must also allow cross-origin requests. Obtain credentials through a flow intended for your application; a token bundled into public JavaScript is visible to everyone who downloads it.

## Add the package

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

## Connect a client

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://your-provider.example/.well-known/jmap",
  bearerToken: "<bearer-token>",
  capabilities: ["mail"],
});
```

Replace both placeholders with your provider's values. The constructor checks the configuration without making an HTTP request. Selecting `mail` makes the mail methods available to TypeScript; it does not enable that extension on the server.

## Make a call

```ts
const mailboxes = await client.api.Mailbox.get({ properties: ["id", "name"] });

for (const mailbox of mailboxes.list) {
  console.log(mailbox.id, mailbox.name);
}
```

The `properties` array selects the fields to return. On this first call, the client fetches the session to discover the API endpoint and primary mail account. It then sends `Mailbox/get`. The promise resolves to the response arguments, including `list`.

The session promise is cached. You can inspect it with `await client.session` and replace it with `await client.refreshSession()`. A failed session load is cached too, so use `refreshSession()` when you are ready to retry.

## Query and retrieve messages

```ts
const query = client.api.Email.query({
  sort: [{ property: "receivedAt", isAscending: false }],
  limit: 5,
});
const messages = await client.api.Email.get({
  ids: query.ref("/ids"),
  properties: ["subject", "from"],
});

for (const message of messages.list) {
  console.log(message.subject, message.from);
}
```

The query finds the five most recent message IDs. The get call uses those IDs to request subjects and senders. The get call joins the queued query before `await` yields control, so they share one request. `.ref("/ids")` tells the server where to obtain the get call's input.

Awaiting the query before creating the get call would send two requests. Read [Batching](../features/batching.md) for the scheduling rules.

## Choose another account

Omitting `accountId` selects the session's primary **mail** account. To access a shared account or a different capability, inspect the session and supply an appropriate account explicitly:

```ts
const session = await client.session;
console.log(session.accounts);

const result = await client.api.Mailbox.get({
  accountId: "<account-id>",
});
```

The default does not change when you call a contacts or custom method. Your chosen account must support the requested capability.

You can now work through the [recipes](./examples.md), configure more [capabilities](../features/capabilities.md), or add [error handling](../reference/errors.md).
