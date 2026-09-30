# json-meta-client

> [!WARNING]
> This library is alpha software.

A typed [JMAP](https://jmap.io/) client for Node.js and browsers.
Choose your server's capabilities, then call methods such as
`client.api.Email.query()`. The client builds the protocol requests
and batches calls made together.

## Quick start

```sh
pnpm add json-meta-client
```

Provide the session URL and bearer token supplied by your JMAP
service:

```ts
import { Client, ref } from "json-meta-client";
import { mail } from "json-meta-client/capabilities";

const client = new Client({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  bearerToken: "<token>",
  capabilities: [mail],
});

const inboxes = await client.api.Mailbox.query({
  filter: { role: "inbox" },
  limit: 1,
});
const inboxId = inboxes.ids[0];
if (!inboxId) throw new Error("No inbox found");

const query = client.api.Email.query({
  filter: { inMailbox: inboxId },
  limit: 10,
});
const emails = await client.api.Email.get({
  ids: ref(query, "/ids"),
  properties: ["id", "subject", "from"],
});
console.log(emails.list);
```

This example finds the inbox, then queries and fetches its emails.
The email query and get run in one request if they fit the server's
limits: `ref()` tells the server to pass the query's IDs to the get
method. Core methods are available on every client. Calls that omit
`accountId` use the primary mail account; pass an ID to use another account.

## Documentation

- [Getting started](docs/getting-started.md): authentication,
  session discovery, Node.js, browsers, and accounts.
- [Capabilities](docs/capabilities.md) and
  [custom capability authoring](docs/custom-capabilities.md).
- [Batching](docs/batching.md),
  [server request limits](docs/request-limits.md), and
  [result references](docs/results-and-references.md).
- [Errors](docs/errors.md), [cancellation](docs/cancellation.md),
  [blobs and events](docs/blobs-and-events.md),
  and [middleware](docs/middleware.md).
- [Public API reference](docs/api-reference.md) and
  [method contracts and inference](docs/method-contracts.md).
- [Executable examples](examples/README.md) and
  [real-server interoperability tests](interop/README.md).

See [supported package imports](docs/package-api.md) for export details
and compatibility checks.
