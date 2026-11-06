# json-meta-client

A TypeScript [JMAP](https://jmap.io/) client for Node.js and browsers. Call your
server's methods through a typed API, combine calls in one request, and pass
results between them without another round trip. The client also handles blob
transfers and state-change subscriptions.

The library is alpha software; its API may change between releases.

```sh
pnpm add json-meta-client
```

Supply your provider's JMAP session URL and a token authorised to read mail.
This example uses the primary mail account to find its inbox:

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail"],
});

const result = await client.api.Mailbox.query({
  filter: { role: "inbox" },
  limit: 1,
});
console.log(result.ids[0] ?? "No inbox found");
```

Follow the [first-request tutorial](https://json-meta-client.dev/getting-started) for runtime
requirements and a complete walkthrough. The manual also includes
[mail recipes](https://json-meta-client.dev/examples),
[authentication options](https://json-meta-client.dev/features/authentication),
and an [API reference](https://json-meta-client.dev/reference/api).

Licensed under [MPL-2.0](./LICENSE).
