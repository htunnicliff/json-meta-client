# Your first JMAP request

json-meta-client is a TypeScript [JMAP](https://jmap.io/) client. JMAP is the
protocol used by mail servers to expose messages, mailboxes, and other account
data. You call methods such as `Mailbox.get()` in JavaScript; the client sends
the corresponding JMAP requests and gives you typed results.

In this tutorial, you will connect to a mail account and print the name of its
inbox. The example only reads data.

## Before you begin

You need your provider's JMAP session URL and a bearer token that can read your
mail account. The provider must support the JMAP Mail capability. The client
uses the session URL you supply; it cannot find a provider from an email address.

Use Node.js 26 for this walkthrough. The repository builds and tests with
Node.js 26.13.0. The package is ESM and relies on modern web APIs, including
`fetch`, `Request`, `Response`, `Blob`, and `Promise.withResolvers`, without
providing polyfills. It also works in modern browsers; the
[browser setup guide](./features/authentication.md#run-in-a-browser) covers
imports and server access there.

## Install the package

In your project directory, run:

```sh
pnpm add json-meta-client
```

## Connect and find your inbox

Create a file named `first-request.mts` with the code below. Replace
`https://jmap.example.com/.well-known/jmap` with your provider's session URL and
`YOUR_ACCESS_TOKEN` with your token. Keep the token out of source control.

```ts [first-request.mts]
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail"],
});

const matches = await client.api.Mailbox.query({
  filter: { role: "inbox" },
  limit: 1,
});
const inboxId = matches.ids[0]!;

const mailboxes = await client.api.Mailbox.get({
  ids: [inboxId],
  properties: ["id", "name"],
});
const inbox = mailboxes.list[0]!;

console.log(inbox.id, inbox.name);
```

Run the file:

```sh
node first-request.mts
```

You should see an inbox ID followed by its name. The name comes from the server
and may be something other than “Inbox”. If the request fails, the
[error reference](./reference/errors.md) explains how to distinguish a connection
failure from a rejected JMAP method.

## What happened

The first method call fetched the server's session document. That document
covers the available accounts and the URLs used for later requests. Because the
example does not pass an `accountId`, the client used the primary mail account.

`Mailbox.query` then found a mailbox by its `inbox` role. A query returns IDs,
so the example passed the first ID to `Mailbox.get` to read the mailbox's name.
The `properties` array asked for just the fields the example uses; TypeScript
reflects that selection in the result type.

These calls ran in separate requests because the example awaited the query
before creating the get call. You can also let the server pass IDs between
calls in one request, using a [result reference](./features/method-calls.md#reference-a-previous-result).

## Continue from here

To read messages rather than mailboxes, follow the
[unread-mail example](./examples.md#list-unread-emails). The
[method call guide](./features/method-calls.md) shows how to select fields,
update objects, and link dependent calls.

When you are ready to build an application, read about
[accounts and capabilities](./features/capabilities.md),
[application design](./best-practices.md), and
[testing without a server](./testing.md). Exact signatures and defaults are in
the [API reference](./reference/api.md).
