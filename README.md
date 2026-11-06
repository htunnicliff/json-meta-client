# json-meta-client

> [!WARNING]
> This library is alpha software.

A TypeScript [JMAP](https://jmap.io/) client for Node.js and browsers, with typed
method calls, automatic batching, result references, blob transfers, and events.

```sh
pnpm add json-meta-client
```

Use your provider's JMAP session URL and an access token authorised to read mail.
The account must support the mail capability.

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  auth: { token: "YOUR_ACCESS_TOKEN" },
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  capabilities: ["mail"],
});

const result = await client.api.Mailbox.query({
  filter: { role: "inbox" },
  limit: 1,
});
const inboxId = result.ids[0];
console.log(inboxId ?? "No inbox found");
```

Start with the [installation and first-request tutorial](https://json-meta-client.dev/),
then follow the [mail recipes](https://json-meta-client.dev/examples).
See [authentication](https://json-meta-client.dev/features/authentication) for
Basic credentials, custom authentication, and migration from `bearerToken`.
The manual covers [method calls](https://json-meta-client.dev/features/method-calls),
[batching](https://json-meta-client.dev/advanced/batching), and
[errors](https://json-meta-client.dev/reference/errors).

Licensed under [MPL-2.0](./LICENSE).
