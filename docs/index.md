# Introduction

json-meta-client turns typed JavaScript calls into JMAP requests. This tutorial
finds your inbox and reads its messages. You need a JMAP server that advertises
`urn:ietf:params:jmap:mail`, an account with that capability, the provider's
session endpoint, and a bearer token authorised to read that account.

Replace `https://jmap.example.com/.well-known/jmap` with that endpoint and
`YOUR_ACCESS_TOKEN` with your token in each example. The library fetches the URL
you supply; it does not discover a provider from an email address.

## Installation

Use a modern runtime with native `fetch`, `Request`, `Response`, `Blob`, and
`Promise.withResolvers`. The project builds and tests with Node.js 26.13.0;
its output targets modern JavaScript without runtime polyfills.

::: code-group

```sh [pnpm]
pnpm add json-meta-client
```

```sh [npm]
npm install json-meta-client
```

```sh [yarn]
yarn add json-meta-client
```

```sh [bun]
bun add json-meta-client
```

```sh [Deno]
deno add npm:json-meta-client
```

:::

In Deno, use the generated package mapping or import from
`"npm:json-meta-client"`. In Node.js, use an ESM project (`"type": "module"` in
`package.json`) and your TypeScript runner or compiler. A browser bundler resolves
the same `"json-meta-client"` import.

## Find your inbox

Save and run the following module. It checks the selected account before querying
its inbox. The result of `query` contains IDs; `get` returns mailbox objects.

```ts [first-request.ts]
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  auth: { token: "YOUR_ACCESS_TOKEN" },
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  capabilities: ["mail"],
});
const session = await client.session;
const accountId =
  session.primaryAccounts["urn:ietf:params:jmap:mail"];
if (
  !accountId ||
  !session.accounts[accountId]?.accountCapabilities[
    "urn:ietf:params:jmap:mail"
  ]
) {
  throw new Error("No primary mail account is available");
}

const inboxQuery = client.api.Mailbox.query({
  accountId,
  filter: { role: "inbox" },
  limit: 1,
});
const inboxGet = client.api.Mailbox.get({
  accountId,
  ids: inboxQuery.resultRef("/ids"),
  properties: ["id", "name"],
});
const [, inboxes] = await Promise.all([
  inboxQuery,
  inboxGet,
]);
const inbox = inboxes.list[0];
if (!inbox)
  throw new Error("This account has no readable inbox");
console.log(inbox.id, inbox.name);
```

You should see the inbox's ID and name. The query and get share one API request:
the server resolves `resultRef("/ids")`. A missing inbox produces an explicit
error; authentication, HTTP, and method failures reject the awaited call.
See [Errors](./reference/errors.md) when a request fails.

## Run in a browser

Serve your page over HTTP(S). The JMAP server must allow your origin through CORS,
including `Authorization` and `Content-Type` request headers, for the session URL
and every API, upload, download, or event URL you use. Check your Content Security
Policy permits those connections. Browser code can access its token; use credentials
intended for the current user and avoid committing them to source control.

For a page without a bundler, the published ESM entry is `dist/index.js`.
This complete page uses an import map with valid JSON. It pins the package version;
update the version when upgrading. The event-source mapping resolves the optional
dynamic import used by [Events](./features/events.md).

<script setup>
import {data as pkg} from './pkg.data.ts'
</script>

```html-vue [index.html]
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>JMAP inbox</title>
    <script type="importmap">
      {
        "imports": {
          "json-meta-client": "https://unpkg.com/json-meta-client@{{ pkg.version }}/dist/index.js",
          "eventsource-client": "https://esm.sh/eventsource-client@1.2.0"
        }
      }
    </script>
  </head>
  <body>
    <pre id="output">Loading inbox…</pre>
    <script type="module">
      import { JsonMetaClient } from "json-meta-client";

      const output = document.querySelector("#output");
      try {
        const client = new JsonMetaClient({
          auth: { token: "YOUR_ACCESS_TOKEN" },
          sessionUrl: "https://jmap.example.com/.well-known/jmap",
          capabilities: ["mail"],
        });
        const session = await client.session;
        const accountId = session.primaryAccounts["urn:ietf:params:jmap:mail"];
        if (!accountId || !session.accounts[accountId]?.accountCapabilities["urn:ietf:params:jmap:mail"]) {
          throw new Error("No primary mail account is available");
        }
        const result = await client.api.Mailbox.query({
          accountId,
          filter: { role: "inbox" },
          limit: 1,
        });
        output.textContent = result.ids[0] ?? "No inbox found";
      } catch (error) {
        output.textContent = String(error);
      }
    </script>
  </body>
</html>
```

For a direct module import, replace the import-map name in the script with
`https://unpkg.com/json-meta-client@VERSION/dist/index.js`, substituting your
installed version for `VERSION`. Keep the event-source mapping if using events.
The build emits `.js`, rather than `.mjs`, files.

## Session and configuration

Construction does not fetch the session. `await client.session` fetches it on first
use, then returns the cached promise. `refreshSession()` always fetches and caches
a new session; call it after account or capability changes, or to retry a failed
session fetch. It does not recreate the configured API.

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  auth: { token: "YOUR_ACCESS_TOKEN" },
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  capabilities: ["mail", "submission"],
});

const cached = await client.session;
const fresh = await client.refreshSession();
console.log(cached.state, fresh.state);
```

Core is always included. Add `"mail"` for mail methods and `"submission"` for
identities and sending. Configuration controls the typed API and request `using`
capabilities; it does not grant server permissions. See
[Capabilities](./features/capabilities.md) for server/account checks and composition,
and [Authentication](./features/authentication.md) for other credential schemes.
Methods default to the primary **mail** account. Pass `accountId` explicitly for
shared or non-mail accounts; see [Method Calls](./features/method-calls.md).

## Read the inbox in pages

This standalone iterator reads messages in a stable order. The first query uses
`position: 0`; subsequent queries anchor after the final **query ID**, even if
some objects disappear before `get`. It stops on an empty query page. The final
empty request also handles servers that return fewer items than the requested
limit. A vanished anchor or another method failure rejects the iterator.

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  auth: { token: "YOUR_ACCESS_TOKEN" },
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  capabilities: ["mail"],
});
const session = await client.session;
const accountId =
  session.primaryAccounts["urn:ietf:params:jmap:mail"];
if (
  !accountId ||
  !session.accounts[accountId]?.accountCapabilities[
    "urn:ietf:params:jmap:mail"
  ]
) {
  throw new Error("No primary mail account is available");
}

const inboxes = await client.api.Mailbox.query({
  accountId,
  filter: { role: "inbox" },
  limit: 1,
});
const inboxId = inboxes.ids[0];
if (!inboxId) throw new Error("No inbox found");

async function* getEmails(limit = 10) {
  if (!Number.isInteger(limit) || limit < 1)
    throw new Error("Use a positive page size");
  let anchor: string | undefined;
  const seen = new Set<string>();
  for (;;) {
    const query = client.api.Email.query({
      accountId,
      filter: { inMailbox: inboxId },
      sort: [
        { property: "receivedAt", isAscending: false },
      ],
      ...(anchor
        ? { anchor, anchorOffset: 1 }
        : { position: 0 }),
      limit,
    });
    const get = client.api.Email.get({
      accountId,
      ids: query.resultRef("/ids"),
      properties: [
        "id",
        "from",
        "to",
        "subject",
        "sentAt",
        "keywords",
      ],
    });
    const [page, emails] = await Promise.all([query, get]);
    if (page.ids.length === 0) return;
    for (const email of emails.list) {
      if (!seen.has(email.id)) {
        seen.add(email.id);
        yield email;
      }
    }
    if (emails.notFound?.length)
      console.warn("Messages disappeared", emails.notFound);
    const next = page.ids.at(-1);
    if (next === anchor)
      throw new Error("Pagination did not advance");
    anchor = next;
  }
}

for await (const email of getEmails()) {
  console.log(
    email.id,
    email.from,
    email.to,
    email.subject,
    email.sentAt,
    email.keywords,
  );
}
```

The `receivedAt` comparator is required for mail servers. For equal timestamps,
JMAP requires the server's tie order to remain stable between queries
([RFC 8620 §5.5](https://jmap.io/spec/rfc8620/#section-5.5)).
A live mailbox can change
between pages: this is not a snapshot, and a new message ahead of the anchor may
be missed. The set above suppresses duplicates; restart or use query-change
synchronisation when you need to reconcile concurrent edits. Keep `limit` within
`maxObjectsInGet` and your server's query limits, and allow two method calls per
request; [Batching](./advanced/batching.md) explains manual limits.

## Next steps

| Task                                         | Guide                                                          |
| -------------------------------------------- | -------------------------------------------------------------- |
| Search, send, reply, move, or attach files   | [Examples](./examples.md)                                      |
| Select properties and reference another call | [Method Calls](./features/method-calls.md)                     |
| Control grouping and cancellation            | [Batching](./advanced/batching.md)                             |
| Transfer binary data                         | [Blobs](./features/blobs.md)                                   |
| Listen for changes                           | [Events](./features/events.md)                                 |
| Intercept transport requests                 | [Hooks](./advanced/hooks.md)                                   |
| Look up signatures or failures               | [API](./reference/api.md), [Errors](./reference/errors.md)     |
| Structure and test an application            | [Best Practices](./best-practices.md), [Testing](./testing.md) |
