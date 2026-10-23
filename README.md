# JSON Meta Client

A TypeScript client for [JMAP](https://jmap.io/), the protocol used by email and other data services. JSON Meta Client gives you typed method calls, automatic request batching, and references between results in the same request. It runs in Node.js and browsers with modern Web APIs.

> [!WARNING]
> The package is alpha software. Public APIs can change between releases.

## Install

```sh
npm install json-meta-client
```

Use a current runtime, such as Node.js 24. You will need a JMAP session URL and a bearer token from your provider. Browser use also requires the provider to allow cross-origin requests.

## Read some mail

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl:
    "https://your-provider.example/.well-known/jmap",
  bearerToken: "<bearer-token>",
  capabilities: ["mail"],
});

const query = client.api.Email.query({
  sort: [{ property: "receivedAt", isAscending: false }],
  limit: 10,
});
const emails = await client.api.Email.get({
  ids: query.ref("/ids"),
  properties: ["subject", "from"],
});

for (const email of emails.list) {
  console.log(email.subject, email.from);
}
```

The query and get call are both created before `await` yields control, so they share one batch. The server uses the IDs from `Email/query` as the input to `Email/get`; the application receives the response arguments directly.

The client discovers endpoint URLs through the session and defaults to its primary mail account. Pass `accountId` explicitly to work with another account. Keep bearer tokens out of source control and public browser bundles.

## Documentation

Start with the [installation and first-call guide](docs/introduction/getting-started.md), then try the [recipes](docs/introduction/examples.md). The [documentation index](docs/index.md) links to feature guides and the API reference.

## Work on the project

The repository pins its Node.js version in `.node-version` and its pnpm version in `package.json`.

```sh
pnpm install
pnpm test
pnpm build
pnpm docs:dev
```

Run `pnpm docs:build` to check the documentation site, `pnpm fmt:check` for formatting, and `pnpm spelling:check` for spelling.

Released under the [MIT license](LICENSE).
