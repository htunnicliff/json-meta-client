# Getting started

Install the package in an ESM project:

```sh
pnpm add json-meta-client
```

Your runtime must provide `fetch`, `URL`, `crypto.randomUUID`,
`queueMicrotask`, and `Promise.withResolvers`; the package includes no
polyfills. Repository checks use the Node version in
[.node-version](../.node-version). See [supported package imports](package-api.md)
for the entry points and compatibility checks.

## Authentication and discovery

Obtain a bearer token and session URL from your JMAP service before
creating a client. Authentication flows, including OAuth, belong in
your application. Use your provider's session URL; a common form is
`https://your-service/.well-known/jmap`. The client sends
`Authorization: Bearer <token>` on session, API, blob, and event source requests. [RFC 8620 section 2](https://www.rfc-editor.org/rfc/rfc8620.html#section-2)
describes JMAP session discovery and the session document.

```ts
import { Client } from "json-meta-client";
import { mail } from "json-meta-client/capabilities";

const client = new Client({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  bearerToken: "<token>",
  capabilities: [mail],
});
const session = await client.session;
console.log(session.apiUrl, session.primaryAccounts);
```

The first access to `client.session` fetches the session document.
API calls also load it automatically. The promise is cached, including
when it rejects; call `await client.refreshSession()` to retry or to
load changes from the server.

`sessionUrl` accepts a URL string or `URL` object. `bearerToken` must
be a nonempty string and is fixed for the client's lifetime. Create
a new client when the token changes.

Choose [capabilities](capabilities.md) that your service supports.
The client warns if a configured capability is absent from the initial
session. Configuration determines method types and request capabilities;
the server determines which features are available.

## Node.js and browsers

The same `Client` configuration works in Node.js and a browser.
Import the package as ESM in Node.js and load credentials through
your application's environment or secret management. The
[mail example](../examples/mail.ts) reads `JMAP_SESSION_URL` and
`JMAP_BEARER_TOKEN` from the environment.

Browser applications can use an ESM-aware bundler. The JMAP service
must permit your origin through CORS, including the authorization
header and the API, blob, and event URLs. Pass the token from your
application's authenticated session. Do not embed a shared service
token in a public bundle. The client uses bearer authentication;
it has no cookie authentication or `fetch` credentials option.

## Calls, properties, and accounts

```ts
const query = await client.api.Email.query({ limit: 10 });
const emails = await client.api.Email.get({
  ids: query.ids,
  properties: ["id", "subject", "from"],
});
```

`Email.query` maps to the JMAP method name `Email/query`.
`Email.get` maps to `Email/get`. Arguments and responses follow the
corresponding [mail protocol](https://www.rfc-editor.org/rfc/rfc8621.html).
For `get`, literal property names narrow the response type to the
requested fields. Check `notFound` for IDs the server could not return.
Likewise, inspect per-object failures in `set` responses even when the
method promise resolves. See [error handling](errors.md).

TypeScript derives method names from your configured capabilities.
At runtime, proxies construct calls on demand: `Object.keys(client.api)`
cannot enumerate methods, and accessing a name does not check whether
the server supports it.

### Choosing an account

Omitting `accountId` uses `session.primaryAccounts[mail.urn]`, even
for entities from other capabilities. Blob uploads and downloads use
the same default, and event metadata identifies the primary mail account.
An explicit account ID is preserved.

`Core.echo` is account-free and skips account injection. Other methods
with object arguments receive the mail default when neither `accountId`
nor `#accountId` is present, even if their contract has no account field.
For account-free extension methods, check the protocol arguments and
use middleware to adjust them if necessary.

Inspect `session.accounts` and `session.primaryAccounts` and pass
`accountId` when using a shared account, a secondary account, a
non-mail account, or a server without a primary mail account:

```ts
const emails = await client.api.Email.get({
  accountId: "<shared-account-id>",
  ids: ["<email-id>"],
  properties: ["id", "subject"],
});
```

Next, learn how to [batch calls](batching.md) or pass results between
methods in one request with [result references](results-and-references.md).
