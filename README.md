<p align="center">
  <a href="https://json-meta-client.dev">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="docs/public/readme-banner-transparent-dark.svg">
      <img src="docs/public/readme-banner.svg" alt="json-meta-client" width="640">
    </picture>
  </a>
</p>

<p align="center">
  <a href="https://npmx.dev/package/json-meta-client"><img src="https://npmx.dev/api/registry/badge/version/json-meta-client" alt="npm version"></a>
  <a href="./LICENSE"><img src="https://npmx.dev/api/registry/badge/license/json-meta-client" alt="License"></a>
  <a href="https://npmx.dev/package/json-meta-client"><img src="https://npmx.dev/api/registry/badge/types/json-meta-client" alt="Types included"></a>
</p>

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

View full documentation and examples on
[json-meta-client.dev](https://json-meta-client.dev), or try the library in
your browser in the [playground](https://json-meta-client.dev/playground).

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

## Versioning

json-meta-client follows semantic versioning. Refer to the
[versioning policy](https://json-meta-client.dev/reference/versioning) for
how changes to its types map to version numbers.

## License

The [MPL-2.0 License](./LICENSE).
