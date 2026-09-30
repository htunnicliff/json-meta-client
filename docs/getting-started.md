# Getting started

Install the package in an ESM project:

```sh
pnpm add json-meta-client
```

Use a modern JavaScript runtime with native `fetch`, `URL`,
`crypto.randomUUID`, `queueMicrotask`, and `Promise.withResolvers`.
The package targets modern JavaScript rather than providing runtime
polyfills. Repository checks use the Node.js version in
[.node-version](../.node-version); see [package compatibility](package-api.md)
for the tested package entry points.

## Authentication and discovery

Get a bearer token and session URL from your JMAP service. The
client sends `Authorization: Bearer <token>` on session, API, blob,
and event source requests. It does not obtain tokens, perform an
OAuth flow, or discover a service from an email address. A common
session URL is `https://your-service/.well-known/jmap`, but use the
URL supplied by your provider. [RFC 8620 section 2](https://www.rfc-editor.org/rfc/rfc8620.html#section-2)
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

Creating a client does not fetch the session. `client.session`
loads it lazily and caches the promise, including a failed load.
API calls load it automatically before sending requests. Use
`await client.refreshSession()` to fetch a new session after a
session failure or a change on the server. The configured token
is fixed for a client instance; create another client when your
authentication token changes. `sessionUrl` accepts a URL string
or a `URL` object. The token must be a nonempty string.

A configured capability absent from the initial session produces
a logger warning. Configuration selects available client types
and request capabilities; it does not enable server features.

## Node.js and browsers

The same `Client` configuration works in Node.js and a browser.
Node.js applications should read credentials from their own secret
or environment management and import the package as ESM. The
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
For `get`, literal property names refine the response type; do not
read properties you did not request. Responses may include `notFound`, and
`set` responses can contain per-object failures without a rejected
method promise. See [error handling](errors.md).

The API uses proxies to create method calls on demand. Entity and
method names are not a runtime catalog, so `Object.keys(client.api)`
does not enumerate supported methods. TypeScript knows the methods
from your configured capabilities. Runtime proxy access does not
validate that an arbitrary name is supported by the server.

You may omit `accountId` for ordinary account-scoped calls. The
current default is specifically `session.primaryAccounts[mail.urn]`,
regardless of the entity's capability. `Core.echo` is account-free
and skips account injection.
The same mail default is used for blob uploads and event source
metadata. An explicitly supplied account ID is preserved.

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

Blob uploads and downloads default to the primary mail account when
`accountId` is omitted. Supply it explicitly for other accounts. For an
account-free protocol method, check its arguments rather than
assuming the injected mail default has protocol meaning. See
[capabilities](capabilities.md), [batching](batching.md), and
[result references](results-and-references.md) for grouped calls.
