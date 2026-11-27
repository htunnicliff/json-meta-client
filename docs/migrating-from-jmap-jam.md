# Migrating from jmap-jam

json-meta-client is the successor to
[jmap-jam](https://www.npmjs.com/package/jmap-jam). This guide shows each
part of jmap-jam 0.13 next to its json-meta-client 1.0 equivalent.

## Installing

json-meta-client needs Node.js 22 or later, and TypeScript 5.4 or later.

```sh
npm remove jmap-jam
npm add json-meta-client
```

## Creating a client

The client is a named export. `auth` replaces `bearerToken`, and
`capabilities` lists the entities the client can call. List `"mail"`,
`"submission"`, and `"vacationResponse"` to match jmap-jam.

::: code-group

```js [jmap-jam]
import JamClient from "jmap-jam";

const jam = new JamClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  bearerToken: "<token>",
});
```

```ts [json-meta-client] {1,5-6}
import { JsonMetaClient } from "json-meta-client";

new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: "<token>",
  capabilities: ["mail", "submission", "vacationResponse"],
});
```

:::

`auth` also takes Basic credentials or a callback. See
[`auth`](./reference/api.md#auth) and
[Capabilities](./features/capabilities.md).

## Custom capabilities

`defineCapability()` replaces `customCapabilities`. Add `withMethods()` to
type the methods. See [Extending](./advanced/extending.md).

::: code-group

```js [jmap-jam]
const jam = new JamClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  bearerToken: "<token>",
  customCapabilities: {
    Note: "urn:example:notes",
  },
});
```

```ts [json-meta-client] {3-6,11}
import { defineCapability } from "json-meta-client";

const notes = defineCapability({
  urn: "urn:example:notes",
  entities: ["Note"],
});

const notesClient = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: "<token>",
  capabilities: ["mail", notes],
});
```

:::

## Results and account IDs

A call resolves to its data, not a `[data, meta]` tuple. The client fills in
`accountId` from the primary account of the method's capability. See
[Account IDs](./features/method-calls.md#account-ids).

::: code-group

```js [jmap-jam]
const accountId = await jam.getPrimaryAccount();

const [mailboxes] = await jam.api.Mailbox.get({
  accountId,
});
```

```ts [json-meta-client]
const mailboxes = await client.api.Mailbox.get();
```

:::

## Plain requests

Call the method on `client.api` instead of `request()`.

::: code-group

```js [jmap-jam]
const [emails] = await jam.request([
  "Email/get",
  {
    accountId,
    ids: ["<emailId>"],
    properties: ["subject"],
  },
]);
```

```ts [json-meta-client]
const emails = await client.api.Email.get({
  ids: ["<emailId>"],
  properties: ["subject"],
});
```

:::

## Several calls in one request

Calls made together are batched into one request, so `requestMany()` isn't
needed. `resultRef()` replaces `$ref()`. See
[Batching](./advanced/batching.md).

::: code-group

```js [jmap-jam]
const [{ emails }] = await jam.requestMany((t) => {
  const emailIds = t.Email.query({
    accountId,
    filter: { inMailbox: "<inboxId>" },
    limit: 10,
  });

  const emails = t.Email.get({
    accountId,
    ids: emailIds.$ref("/ids"),
    properties: ["subject"],
  });

  return { emailIds, emails };
});
```

```ts [json-meta-client] {7}
const emailIds = client.api.Email.query({
  filter: { inMailbox: "<inboxId>" },
  limit: 10,
});

const recentEmails = await client.api.Email.get({
  ids: emailIds.resultRef("/ids"),
  properties: ["subject"],
});
```

:::

To await several results, use `Promise.all`:

::: code-group

```js [jmap-jam]
const [{ inboxes, identities }] = await jam.requestMany(
  (t) => ({
    inboxes: t.Mailbox.query({
      accountId,
      filter: { role: "inbox" },
    }),
    identities: t.Identity.get({ accountId }),
  }),
);
```

```ts [json-meta-client]
const [inboxes, identities] = await Promise.all([
  client.api.Mailbox.query({ filter: { role: "inbox" } }),
  client.api.Identity.get(),
]);
```

:::

## Method call IDs

The client generates method call IDs. Pass `id` to choose one.

::: code-group

```js [jmap-jam]
const [{ probe }] = await jam.requestMany((t) => ({
  probe: t.Core.echo({ hello: "world" }),
}));
```

```ts [json-meta-client] {3}
const probe = await client.api.Core.echo(
  { hello: "world" },
  { id: "probe" },
);
```

:::

## Creation references

`createdRef()` replaces hand-written `"#id"` strings, and checks the ID
against the keys of `create`. Make the calls that use it in the same batch.
See [Creation references](./features/method-calls.md#creation-references).

::: code-group

```js [jmap-jam]
await jam.requestMany((t) => ({
  draft: t.Email.set({
    accountId,
    create: {
      hello: {
        mailboxIds: { [draftsId]: true },
        subject: "Hello",
      },
    },
  }),
  send: t.EmailSubmission.set({
    accountId,
    create: {
      send: { emailId: "#hello", identityId },
    },
  }),
}));
```

```ts [json-meta-client] {13}
const draftsId = "<draftsId>";
const identityId = "<identityId>";

const draft = client.api.Email.set({
  create: {
    hello: { mailboxIds: { [draftsId]: true }, subject: "Hello" },
  },
});

void client.api.EmailSubmission.set({
  create: {
    send: {
      emailId: draft.createdRef("hello"),
      identityId,
    },
  },
});
```

:::

## Updates

As in JMAP, a plain object in `update` replaces the whole property. To
change only some keys, wrap them in `patch()`. The client builds and escapes
the JSON Pointer paths. See
[Patch updates](./features/method-calls.md#patch-updates).

::: code-group

```js [jmap-jam]
await jam.api.Email.set({
  accountId,
  update: {
    [emailId]: {
      [`mailboxIds/${archiveId}`]: true,
      [`mailboxIds/${inboxId}`]: null,
      "keywords/$seen": true,
    },
  },
});
```

```ts [json-meta-client] {1,10-14}
import { patch } from "json-meta-client";

const emailId = "<emailId>";
const archiveId = "<archiveId>";
const inboxId = "<inboxId>";

await client.api.Email.set({
  update: {
    [emailId]: {
      mailboxIds: patch({
        [archiveId]: true,
        [inboxId]: null,
      }),
      keywords: patch({ $seen: true }),
    },
  },
});
```

:::

Paths written by hand are now typed. A path built from a variable is typed
as `string`, so build it with `patchMap()`:

::: code-group

```js [jmap-jam]
await jam.api.Email.set({
  accountId,
  update: {
    [emailId]: { [`mailboxIds/${archiveId}`]: true },
  },
});
```

```ts [json-meta-client] {1,5}
import { patchMap } from "json-meta-client";

await client.api.Email.set({
  update: {
    [emailId]: patchMap("mailboxIds", { [archiveId]: true }),
  },
});
```

:::

## Request options

Options apply to the whole client, through [hooks](./advanced/hooks.md):

- `beforeFetch` replaces `fetchInit`.
- `beforeJmapRequest` can add `createdIds`.
- For `using`, list the URN in a capability's
  [`dependsOn`](./advanced/extending.md#depending-on-other-urns).

::: code-group

```js [jmap-jam]
await jam.api.Mailbox.get(
  { accountId },
  {
    fetchInit: { headers: { "X-Trace": "<traceId>" } },
    createdIds: {},
  },
);
```

```ts [json-meta-client] {5-15}
new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: "<token>",
  capabilities: ["mail"],
  hooks: {
    beforeFetch: [
      ({ httpRequest }) => {
        httpRequest.headers.set("X-Trace", "<traceId>");
        return httpRequest;
      },
    ],
    beforeJmapRequest: [
      ({ jmapRequest }) => ({ ...jmapRequest, createdIds: {} }),
    ],
  },
});
```

:::

## Response metadata

Read what `meta` held in the `afterJmapResponse` and `afterFetch` hooks.

::: code-group

```js [jmap-jam]
const [, meta] = await jam.api.Mailbox.get({ accountId });

console.log(meta.sessionState, meta.createdIds);
console.log(meta.response.status);
```

```ts [json-meta-client] {5-21}
new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: "<token>",
  capabilities: ["mail"],
  hooks: {
    afterJmapResponse: [
      ({ jmapResponse }) => {
        console.log(
          jmapResponse.sessionState,
          jmapResponse.createdIds,
        );
        return jmapResponse;
      },
    ],
    afterFetch: [
      ({ httpResponse }) => {
        console.log(httpResponse.status);
        return httpResponse;
      },
    ],
  },
});
```

:::

## Errors

The client throws `Error` subclasses instead of plain problem details. Only
the failed call rejects, and the rest of its batch resolves. See
[Errors](./reference/errors.md).

::: code-group

```js [jmap-jam]
try {
  await jam.api.Email.query({ accountId, sort });
} catch (error) {
  if (JamClient.isProblemDetails(error)) {
    console.error(error.type);
  }
}
```

```ts [json-meta-client] {1,8-12}
import { isHttpError, isJmapError } from "json-meta-client";

try {
  await client.api.Email.query({
    sort: [{ property: "size", isAscending: false }],
  });
} catch (error) {
  if (isJmapError(error)) {
    console.error(error.type);
  } else if (isHttpError(error)) {
    console.error(error.status);
  }
}
```

:::

## Session

The client loads the session on first use and caches it.
`refreshSession()` replaces `JamClient.loadSession()`, and updates the
cache.

::: code-group

```js [jmap-jam]
const session = await jam.session;
const accountId = await jam.getPrimaryAccount();

const fresh = await JamClient.loadSession(
  sessionUrl,
  authHeader,
);
```

```ts [json-meta-client] {2-3,5}
const session = await client.session;
const mailAccountId =
  session.primaryAccounts["urn:ietf:params:jmap:mail"]!;

const fresh = await client.refreshSession();
```

:::

## Blobs

Blob transfers are on `client.blob`, and still require `accountId`. `type`
and `name` replace `mimeType` and `fileName`. See [Blobs](./features/blobs.md).

::: code-group

```js [jmap-jam]
const uploaded = await jam.uploadBlob(accountId, file);

const response = await jam.downloadBlob({
  accountId,
  blobId: uploaded.blobId,
  mimeType: "text/plain",
  fileName: "notes.txt",
});
```

```ts [json-meta-client] {3-5,7,10-11}
const file = new Blob(["Hello"], { type: "text/plain" });

const uploaded = await client.blob.upload(file, {
  accountId: mailAccountId,
});

const response = await client.blob.download({
  accountId: mailAccountId,
  blobId: uploaded.blobId,
  type: "text/plain",
  name: "notes.txt",
});
```

:::

## Events

`onStateChange()` replaces `connectEventSource()`. The handler gets one
change per type and account. The client reads the stream with `fetch`, so
`auth` applies to each connection, and it reconnects on its own. See
[Events](./features/events.md).

::: code-group

```js [jmap-jam]
const sse = await jam.connectEventSource({
  types: ["Email"],
  ping: 30,
  closeafter: "no",
});

sse.addEventListener("state", (event) => {
  const { changed } = JSON.parse(event.data);
  // { [accountId]: { [type]: state } }
});
```

```ts [json-meta-client] {1,8,12}
const subscription = await client.onStateChange(
  (error, change) => {
    if (error) {
      console.error(error);
      return;
    }

    if (change.entity === "Email") {
      console.log(change.accountId, change.state);
    }
  },
  { pingSeconds: 30 },
);
```

:::

The client subscribes to every type, so filter on `change.entity`. To
unsubscribe, dispose of the subscription or pass a `signal`.

## Types

`json-meta-client/rfc-types` replaces `jmap-rfc-types`. Some names differ,
such as `ReadableEmail` for `Email`.

::: code-group

```js [jmap-jam]
import type { Email, Mailbox } from "jmap-rfc-types";
```

```ts [json-meta-client]
import type {
  Mailbox,
  ReadableEmail,
} from "json-meta-client/rfc-types";
```

:::
