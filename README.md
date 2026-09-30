# json-meta-client

> [!WARNING]
> This library is alpha software.

A typed [JMAP](https://jmap.io/) client for modern Node.js and
browsers. Configure the capabilities your server supports, call
methods such as `client.api.Email.query()`, and let the client
assemble JMAP requests and batch synchronous calls.

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

The mailbox query completes first. The email query and get share
a batching window; `ref()` asks the server to use the query's IDs
in the same request when the group fits the server's limits. Core capabilities are always
included. Omitted `accountId` values use the session's primary
mail account; specify another account explicitly when needed.

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

Run `pnpm build && pnpm examples:check` to compile the examples
against the built package's public exports.
