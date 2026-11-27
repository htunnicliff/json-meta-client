# Migrating from jmap-jam

json-meta-client is the successor to
[jmap-jam](https://www.npmjs.com/package/jmap-jam). It keeps the fluent
`api.<Entity>.<method>()` style, and adds automatic batching, default
accounts, typed references and patches, and error classes.

This page maps each part of jmap-jam 0.13 to json-meta-client 1.0. The
jmap-jam examples come first, followed by their json-meta-client
equivalents.

## At a glance

| jmap-jam                           | json-meta-client                                            |
| ---------------------------------- | ----------------------------------------------------------- |
| `import JamClient from "jmap-jam"` | `import { JsonMetaClient } from "json-meta-client"`         |
| `bearerToken`                      | [`auth`](./reference/api.md#auth)                           |
| Every entity, always               | [`capabilities`](./features/capabilities.md), required      |
| `customCapabilities`               | [`defineCapability()`](./advanced/extending.md)             |
| `[data, meta]` results             | The data alone                                              |
| `accountId` on every call          | [Filled in for you](./features/method-calls.md#account-ids) |
| `request([method, args])`          | `client.api.Entity.method(args)`                            |
| `requestMany()` and `$ref()`       | [Batching](./advanced/batching.md) and `resultRef()`        |
| `"#creationId"` strings            | `createdRef()`                                              |
| JSON Pointer `update` keys         | [`patch()` and `patchMap()`](#updates)                      |
| `fetchInit`, `using`, `createdIds` | [Hooks](./advanced/hooks.md) and capabilities               |
| Thrown problem details             | [Error classes](./reference/errors.md)                      |
| `getPrimaryAccount()`              | `session.primaryAccounts`                                   |
| `JamClient.loadSession()`          | `client.refreshSession()`                                   |
| `uploadBlob()` / `downloadBlob()`  | `client.blob.upload()` / `client.blob.download()`           |
| `connectEventSource()`             | [`client.onStateChange()`](./features/events.md)            |
| `jmap-rfc-types`                   | `json-meta-client/rfc-types`                                |

## Installing

Replace the package:

```sh
npm remove jmap-jam
npm add json-meta-client
```

json-meta-client needs Node.js 22 or later, and TypeScript 5.4 or later if
you use TypeScript. It has no runtime dependencies.

## Creating a client

jmap-jam exported its client as the default export and took a bearer
token:

```js
import JamClient from "jmap-jam";

const jam = new JamClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  bearerToken: "<token>",
});
```

json-meta-client exports `JsonMetaClient` by name. `auth` replaces
`bearerToken`, and `capabilities` lists what the client uses:

```ts
import { JsonMetaClient } from "json-meta-client";

new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: "<token>",
  capabilities: ["mail", "submission"],
});
```

`auth` also accepts Basic credentials or a callback. See
[`auth`](./reference/api.md#auth).

jmap-jam knew the `Mailbox`, `Thread`, `Email`, `SearchSnippet`, `Identity`,
`EmailSubmission`, and `VacationResponse` entities on every client. In
json-meta-client, an entity is available only when a configured capability
declares it. To match jmap-jam, list these:

```ts
new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: "<token>",
  capabilities: ["mail", "submission", "vacationResponse"],
});
```

A call on an entity that no capability declares rejects with
`UnknownEntityError` and is never sent. `Core`, `Blob`, and
`PushSubscription` are always available. The
[capabilities reference](./reference/capabilities.md) lists every built-in
capability, including contacts, quotas, Sieve, and sharing.

The examples below use a `client` configured with `"mail"` and
`"submission"`.

### Custom capabilities

jmap-jam mapped custom entities to URNs with `customCapabilities`:

```js
const jam = new JamClient({
  sessionUrl,
  bearerToken,
  customCapabilities: {
    Note: "urn:example:notes",
  },
});
```

In json-meta-client, define the capability with `defineCapability()` and
add it to `capabilities`:

```ts
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

Without `withMethods()`, the capability's methods are untyped, as they were
in jmap-jam. Add `withMethods()` to type their arguments and results. See
[Extending](./advanced/extending.md).

## Method calls

### Results

jmap-jam resolved each call to a `[data, meta]` tuple, and every call needed
an `accountId`:

```js
const accountId = await jam.getPrimaryAccount();

const [mailboxes] = await jam.api.Mailbox.get({
  accountId,
});
```

json-meta-client resolves to the data alone, and fills in `accountId`:

```ts
const mailboxes = await client.api.Mailbox.get();
```

The default account depends on the method. jmap-jam's
`getPrimaryAccount()` always returned the primary mail account. The client
uses the primary account of the capability that owns the method, so
`ContactCard` calls go to the primary contacts account. Pass `accountId` to
choose another account. See
[Account IDs](./features/method-calls.md#account-ids).

To read what `meta` held, see [Response metadata](#response-metadata).

### Plain requests

jmap-jam's `request()` took a method name and arguments:

```js
const [emails] = await jam.request([
  "Email/get",
  {
    accountId,
    ids: ["<emailId>"],
    properties: ["subject"],
  },
]);
```

json-meta-client has no separate form. Call the method on `client.api`:

```ts
const emails = await client.api.Email.get({
  ids: ["<emailId>"],
  properties: ["subject"],
});
```

### Several calls in one request

jmap-jam sent several calls together with `requestMany()`. Each call was a
draft, and `$ref()` created a result reference:

```js
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

json-meta-client batches calls automatically. Calls made in the same tick
share one request, so make them together and await only the results you
use. `resultRef()` replaces `$ref()`:

```ts
const emailIds = client.api.Email.query({
  filter: { inMailbox: "<inboxId>" },
  limit: 10,
});

const recentEmails = await client.api.Email.get({
  ids: emailIds.resultRef("/ids"),
  properties: ["subject"],
});
```

Use `Promise.all` to await several results:

```ts
const [inboxes, identities] = await Promise.all([
  client.api.Mailbox.query({ filter: { role: "inbox" } }),
  client.api.Identity.get(),
]);
```

An `await` closes the batch, so a call made after it goes in a new request.
A result reference must point to a call in the same batch. See
[Batching](./advanced/batching.md).

jmap-jam used the keys of the returned object as method call IDs. The
client generates IDs. To choose one, pass the `id` option:

```ts
const probe = client.api.Core.echo(
  { hello: "world" },
  { id: "probe" },
);
```

### Creation references

jmap-jam had no helper for creation references, so they were written by
hand as `"#"` and the creation ID:

```js
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

json-meta-client adds `createdRef()` to `/set` calls. It checks the ID
against the keys of `create`, in the types and at runtime:

```ts
const [drafts, senders] = await Promise.all([
  client.api.Mailbox.query({ filter: { role: "drafts" } }),
  client.api.Identity.get(),
]);
const draftsId = drafts.ids[0]!;
const identityId = senders.list[0]!.id;

const draft = client.api.Email.set({
  create: {
    hello: {
      mailboxIds: { [draftsId]: true },
      subject: "Hello",
    },
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

Call `createdRef()` before awaiting the `/set` call, and make the calls that
use it in the same batch. Otherwise, it throws `CreationReferenceError`. See
[Creation references](./features/method-calls.md#creation-references).

## Updates

The `update` argument of a `/set` call works as JMAP defines it: each key
names a property, and its value replaces the whole property. That hasn't
changed. In both libraries, this update removes the email from every other
mailbox:

```ts
await client.api.Email.set({
  update: {
    "<emailId>": { mailboxIds: { "<archiveId>": true } },
  },
});
```

To change only some keys, jmap-jam needed JSON Pointer paths, built by hand
and untyped:

```js
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

json-meta-client adds `patch()`, which changes only the keys it's given. The
client builds the paths and escapes `~` and `/`:

```ts
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

Paths written by hand still work, and are now typed. A path built from a
variable is typed as a plain `string`, so use `patchMap()` to build it
instead:

```ts
import { patchMap } from "json-meta-client";

await client.api.Email.set({
  update: {
    [emailId]: {
      ...patchMap("mailboxIds", { [archiveId]: true }),
      "keywords/$seen": true,
    },
  },
});
```

See [Patch updates](./features/method-calls.md#patch-updates).

## Request options

jmap-jam took options as the second argument of each call:

```js
await jam.api.Mailbox.get(
  { accountId },
  {
    fetchInit: { headers: { "X-Trace": traceId } },
    using: ["urn:example:extra"],
    createdIds: {},
  },
);
```

json-meta-client batches calls, so these options apply to the client
instead:

- **`fetchInit`**: use a `beforeFetch` hook to change each HTTP request.
- **`using`**: the client builds `using` from the capabilities each batch
  calls. To send another URN with a capability's calls, list it in
  [`dependsOn`](./advanced/extending.md#depending-on-other-urns).
- **`createdIds`**: use a `beforeJmapRequest` hook to add it to the request.

```ts
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
      ({ jmapRequest }) => ({
        ...jmapRequest,
        createdIds: {},
      }),
    ],
  },
});
```

See [Hooks](./advanced/hooks.md).

## Response metadata

jmap-jam returned `sessionState`, `createdIds`, and the Fetch `Response` in
`meta`:

```js
const [, meta] = await jam.api.Mailbox.get({ accountId });
console.log(meta.sessionState, meta.response.status);
```

In json-meta-client, read them in hooks. `afterJmapResponse` receives each
batch's JMAP response, and `afterFetch` receives each HTTP response:

```ts
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

## Errors

jmap-jam threw plain values. An HTTP error threw the problem details or the
response text. A method error threw its problem details, and
`requestMany()` threw an array of them when any call failed:

```js
try {
  await jam.api.Email.query({ accountId, sort });
} catch (error) {
  if (JamClient.isProblemDetails(error)) {
    console.error(error.type);
  }
}
```

json-meta-client throws `Error` subclasses with type guards. A method error
is a `JmapError`, and only the failed call rejects. The rest of its batch
still resolves:

```ts
import { isHttpError, isJmapError } from "json-meta-client";

try {
  await client.api.Email.query({
    sort: [{ property: "size", isAscending: false }],
  });
} catch (error) {
  if (isJmapError(error)) {
    console.error(error.type); // e.g. "unsupportedSort"
  } else if (isHttpError(error)) {
    console.error(error.status, error.responseData);
  }
}
```

`JmapError.isProblemDetails()` replaces `JamClient.isProblemDetails()`. See
the [Errors reference](./reference/errors.md).

## Session

jmap-jam fetched the session when the client was created. To fetch it
again, `JamClient.loadSession()` returned a new session but didn't update
the client's:

```js
const session = await jam.session;
const accountId = await jam.getPrimaryAccount();
```

json-meta-client fetches the session on first use and caches it.
`refreshSession()` fetches it again and updates the cache:

```ts
const session = await client.session;
const mailAccountId =
  session.primaryAccounts["urn:ietf:params:jmap:mail"]!;

await client.refreshSession();
```

## Blobs

jmap-jam took the account as the first argument of `uploadBlob()`, and
`mimeType` and `fileName` in `downloadBlob()`:

```js
const uploaded = await jam.uploadBlob(accountId, file);

const response = await jam.downloadBlob({
  accountId,
  blobId: uploaded.blobId,
  mimeType: "text/plain",
  fileName: "notes.txt",
});
```

In json-meta-client, the transfers are on `client.blob`. The account moves
into the options, and `type` and `name` replace `mimeType` and `fileName`.
Both still require `accountId`:

```ts
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

See [Blobs](./features/blobs.md).

## Events

jmap-jam's `connectEventSource()` returned the global `EventSource`. Its
messages held the raw JMAP `StateChange`:

```js
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

json-meta-client replaces it with `onStateChange()`. The handler receives
one change for each type in each account, or an error:

```ts
await client.onStateChange(
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

Other differences:

- **Authentication**: `EventSource` can't send headers, so jmap-jam's
  stream couldn't carry the bearer token. The client reads the stream with
  `fetch`, and applies `auth` to each connection and reconnect.
- **Reconnects**: the client reconnects when the stream drops, sends
  `Last-Event-ID`, and backs off after repeated failures.
- **Types**: the client subscribes to every type. Check `change.entity` in
  the handler instead of passing `types`.
- **Closing**: `onStateChange()` resolves to a `Disposable`. Dispose of it,
  or pass a `signal`, to unsubscribe. There is no `closeafter` option.

With `webSocketTransport()`, changes can also arrive over WebSocket push.
See [Events](./features/events.md).

## Types

jmap-jam's types came from the `jmap-rfc-types` package. json-meta-client
includes its own, which follow the RFCs more closely. Import them from
`json-meta-client/rfc-types`:

```ts
import type {
  Mailbox,
  ReadableEmail,
} from "json-meta-client/rfc-types";

type Subject = ReadableEmail["subject"];
type Role = Mailbox["role"];
```

Some names differ. For example, jmap-rfc-types' `Email` is `ReadableEmail`.

Method arguments now reject properties a method doesn't declare, so a
misspelled property is a type error. See [Types](./reference/types.md).
