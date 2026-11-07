# json-meta-client

[![npm](https://img.shields.io/npm/v/json-meta-client?style=for-the-badge)](https://npmx.dev/package/json-meta-client)
[![License](https://img.shields.io/npm/l/json-meta-client?style=for-the-badge&color=1d4ed8)](./LICENSE)

## Introduction

json-meta-client is a TypeScript [JMAP](https://jmap.io/) client for Node.js
and browsers.

With json-meta-client, you call your server's methods through a typed API.
Calls made together are sent as one request, and results flow between them
without another round trip.

It features:

- Typed method calls for core, mail, contacts, and more
- Automatic batching of method calls into one request
- Result references between calls in a batch
- Blob uploads and downloads
- Subscriptions to server state changes
- Extensions for new capabilities and methods
- Comprehensive error classes
- Built and tested against the JMAP RFCs

...and a lot more.

The library is alpha software; its API may change between releases.

View full documentation and examples on
[json-meta-client.dev](https://json-meta-client.dev).

## Quick Start

```sh
pnpm add json-meta-client
```

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: "YOUR_ACCESS_TOKEN",
  capabilities: ["mail"],
});

const unread = client.api.Email.query({
  filter: { notKeyword: "$seen" },
  limit: 5,
});

const emails = await client.api.Email.get({
  ids: unread.resultRef("/ids"),
  properties: ["subject", "from"],
});

for (const { subject, from } of emails.list) {
  console.log(subject, from);
}
```

In this example, `Email/query` finds up to five unread emails, and `Email/get`
reads their subjects and senders. The client sends both calls in a single
request, passing the query's IDs to `Email/get` with a result reference.

Follow the [getting started guide](https://json-meta-client.dev/getting-started)
for runtime requirements and a complete walkthrough.

## License

The [MPL-2.0 License](./LICENSE).
