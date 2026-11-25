# Migrating from 0.14

Version 1.0 changes how the client authenticates, how hooks work, which
account a method call goes to, and how strictly arguments are checked. This
page lists every breaking change since 0.14, in the order you're likely to
hit them. Each section says what changed, shows the code before and after,
and says how to find the code it affects.

Start by upgrading the package and running the type checker. Most changes
show up as type errors, and the sections below explain each one.

```sh
pnpm add json-meta-client@^1
```

## Authentication

**What changed:** the `bearerToken` option is now `auth`. It still takes a
token, and it also takes Basic credentials or a function that authenticates
each request. The client applies `auth` to every request it makes, including
blob transfers and event stream reconnects.

::: code-group

```js [Before (0.14)]
new JsonMetaClient({
  bearerToken: "<token>",
  sessionUrl: "https://<something>/.well-known/jmap",
  capabilities: ["mail"],
});
```

```ts [After (1.0)]
import { JsonMetaClient } from "json-meta-client";

new JsonMetaClient({
  auth: "<token>",
  sessionUrl: "https://<something>/.well-known/jmap",
  capabilities: ["mail"],
});
```

:::

**Find it:** search for `bearerToken`. Refer to
[`auth`](./reference/api.md#auth) for the other forms.

## Hooks

**What changed:** the HTTP hooks are renamed, and every hook receives named
arguments that say which layer they belong to.

| 0.14                       | 1.0                               |
| -------------------------- | --------------------------------- |
| `hooks.beforeRequest`      | `hooks.beforeFetch`               |
| `hooks.afterResponse`      | `hooks.afterFetch`                |
| `({ request })`            | `({ httpRequest })`               |
| `({ request, response })`  | `({ httpRequest, httpResponse })` |
| `BeforeRequestHook` (type) | `BeforeFetchHook`                 |
| `AfterResponseHook` (type) | `AfterFetchHook`                  |

::: code-group

```js [Before (0.14)]
new JsonMetaClient({
  bearerToken: "<token>",
  sessionUrl: "https://<something>/.well-known/jmap",
  capabilities: ["mail"],
  hooks: {
    beforeRequest: [
      ({ request }) => {
        request.headers.set(
          "X-Trace-Id",
          crypto.randomUUID(),
        );
        return request;
      },
    ],
    afterResponse: [
      ({ response }) => {
        console.debug(response.status);
        return response;
      },
    ],
  },
});
```

```ts [After (1.0)]
new JsonMetaClient({
  auth: "<token>",
  sessionUrl: "https://<something>/.well-known/jmap",
  capabilities: ["mail"],
  hooks: {
    beforeFetch: [
      ({ httpRequest }) => {
        httpRequest.headers.set(
          "X-Trace-Id",
          crypto.randomUUID(),
        );
        return httpRequest;
      },
    ],
    afterFetch: [
      ({ httpResponse }) => {
        console.debug(httpResponse.status);
        return httpResponse;
      },
    ],
  },
});
```

:::

The fetch hooks now also run for event stream connections. New
`beforeJmapRequest` and `afterJmapResponse` hooks see each batch as a JMAP
Request and Response, and `beforeEventSourceConnect` and
`afterEventSourceConnect` see each event stream connection.

**Find it:** search for `beforeRequest`, `afterResponse`,
`BeforeRequestHook`, and `AfterResponseHook`. Refer to the
[hooks guide](./advanced/hooks.md).

## Middleware

**What changed:** the `middleware` option is removed. A middleware function
received each method call's arguments. To change outgoing method calls, use
a `beforeJmapRequest` hook, which receives the whole JMAP Request, including
every call's arguments.

::: code-group

```js [Before (0.14)]
new JsonMetaClient({
  bearerToken: "<token>",
  sessionUrl: "https://<something>/.well-known/jmap",
  capabilities: ["mail"],
  middleware: [
    (args) => {
      console.debug(args);
      return args;
    },
  ],
});
```

```ts [After (1.0)]
new JsonMetaClient({
  auth: "<token>",
  sessionUrl: "https://<something>/.well-known/jmap",
  capabilities: ["mail"],
  hooks: {
    beforeJmapRequest: [
      ({ jmapRequest }) => {
        for (const [, args] of jmapRequest.methodCalls) {
          console.debug(args);
        }
        return jmapRequest;
      },
    ],
  },
});
```

:::

**Find it:** search for `middleware`. Passing it is now a type error, and
it is ignored at runtime.

## Default account IDs

**What changed:** a method call without `accountId` used to go to the
primary mail account, whatever the method. It now goes to the primary
account of the capability that owns the method, chosen when the batch is
sent:

- `ContactCard/get` goes to `session.primaryAccounts["urn:ietf:params:jmap:contacts"]`,
  `Email/get` to the primary mail account, and so on.
- When the session names no primary account for the capability, the client
  uses the only account whose `accountCapabilities` list it. With several
  such accounts, the call rejects with a `ConfigurationError`, and the rest
  of the batch still goes ahead. Pass `accountId` to choose one.
- `Core/echo` and `PushSubscription` calls get no `accountId`.
- `$args.accountId` is absent until the batch is sent. It used to throw
  "Session not yet resolved" when read before the session loaded.
- `beforeJmapRequest` hooks see `accountId` as a plain value on each call's
  arguments.

Code that only uses mail methods, on a server with a primary mail account,
works as before.

**Find it:** look for calls to non-mail methods without `accountId`, such as
contacts, sieve, quota, or sharing methods, and for code that reads
`$args.accountId`. Refer to [Account IDs](./features/method-calls.md#account-ids).

### Custom capabilities

A capability from `defineCapability()` gets the same default, from its own
URN. To leave some methods without a default, use the new `defaultAccount`
setting. A method set to `null` requires `accountId` at the type level.

```ts
import { defineCapability } from "json-meta-client";

const tasks = defineCapability({
  urn: "urn:example:tasks",
  entities: ["Task"],
  defaultAccount: { "*": "primary", "Task/copy": null },
});
```

Two capabilities that claim the same method with different settings make
the constructor throw `CapabilityConfigurationError`.

## Blob account IDs

**What changed:** `client.blob.upload()`, `client.blob.download()`, and
`Blob/copy` now require `accountId`. They used to default to the primary
mail account, but the right account depends on what the blob is for.

::: code-group

```js [Before (0.14)]
const uploaded = await client.blob.upload(file);
const response = await client.blob.download({
  blobId: uploaded.blobId,
  type: "text/plain",
  name: "notes.txt",
});
```

```ts [After (1.0)]
const session = await client.session;
const accountId =
  session.primaryAccounts["urn:ietf:params:jmap:mail"]!;
const file = new Blob(["Notes"], { type: "text/plain" });

const uploaded = await client.blob.upload(file, {
  accountId,
});
const response = await client.blob.download({
  accountId,
  blobId: uploaded.blobId,
  type: "text/plain",
  name: "notes.txt",
});
```

:::

For `Blob/copy`, `accountId` is the destination account. `Email/copy` and
`ContactCard/copy` still default it.

**Find it:** the type checker reports each call. Search for `blob.upload`,
`blob.download`, and `Blob.copy`.

## State changes

**What changed:** `isPrimaryAccount` on an [`onStateChange()`](./reference/api.md#onstatechange)
payload is now decided per entity. It is `true` when an `Entity/get` call
for the changed entity, without `accountId`, would go to that account. It
used to be `true` only for the primary mail account, whatever changed.

With a primary mail account A and a primary contacts account B:

| State change       | 0.14    | 1.0     |
| ------------------ | ------- | ------- |
| `Email` in A       | `true`  | `true`  |
| `ContactCard` in B | `false` | `true`  |
| `Email` in B       | `false` | `false` |
| `ContactCard` in A | `true`  | `false` |

Event stream connection failures now reach the handler as a
`StateChangeError`.

**Find it:** search for `isPrimaryAccount`. Code that only watches mail
types sees no difference.

## Result references

**What changed:** a `resultRef()` is accepted only as a whole, top-level
argument, as RFC 8620 section 3.7 requires. The types reject one nested in
an object, such as a `filter` condition, or in an array. At runtime, the
client rejects such a call with `ResultReferenceError` before sending it,
and sends the rest of the batch. It also rejects a reference to a call from
an earlier batch, and arguments that name both `foo` and `#foo`.

::: code-group

```js [Before (0.14)]
const mailboxes = client.api.Mailbox.query({
  filter: { role: "inbox" },
});
const emails = client.api.Email.query({
  // A reference nested in a filter, which servers don't resolve
  filter: { inMailbox: mailboxes.resultRef("/ids/0") },
});
```

```ts [After (1.0)]
const mailboxes = await client.api.Mailbox.query({
  filter: { role: "inbox" },
});
const emails = client.api.Email.query({
  filter: { inMailbox: mailboxes.ids[0]! },
});
```

:::

**Find it:** the type checker reports nested references. At runtime, look
for `ResultReferenceError`. Refer to
[Result references](./features/method-calls.md#result-references).

## Stricter arguments

**What changed:** method arguments reject properties the method doesn't
declare, at any depth: in `/set` `create` and `update` entries, in filter
conditions, including inside `AND`, `OR`, and `NOT`, and at the top level.
A misspelled property, a property the server sets, or a filter condition
from a capability the client doesn't configure used to compile.

Method contracts also follow the RFC types more closely. For example,
`mailboxIds` is required when creating an email, and an email address's
`name` is `string | null`.

```ts
void client.api.Email.query({
  // @ts-expect-error `inMailboxes` isn't an Email/query filter condition
  filter: { inMailboxes: "inbox-id" },
});
```

**Find it:** the type checker reports each property. Fix the spelling,
remove properties the server sets, or add the capability that declares the
condition.

## Unknown entities

**What changed:** calling a method on an entity that no configured
capability declares, such as `client.api.Foo.bar({})`, now rejects with
`UnknownEntityError` and sends nothing. It used to be sent without a
capability URN in `using`. `Core`, `Blob`, and `PushSubscription` stay
callable without listing `core`.

**Find it:** look for `UnknownEntityError` at runtime, and for
`beforeJmapRequest` hooks that add URNs to `using`. Declare the entity with a
built-in capability or [`defineCapability()`](./advanced/extending.md)
instead.

## S/MIME

**What changed:** the S/MIME properties and filters from RFC 9219 need the
`smime` capability. A client configured with only `"mail"` no longer accepts
the `smime*` properties in `Email/get`, or the `hasSmime` and
`hasVerifiedSmime` filter conditions. Configure `"smime"` together with
`"mail"`; `"smime"` alone throws `CapabilityConfigurationError`.

```ts
const smimeClient = new JsonMetaClient({
  auth: "<token>",
  sessionUrl: "https://<something>/.well-known/jmap",
  capabilities: ["mail", "smime"],
});

void smimeClient.api.Email.get({
  ids: ["<email-id>"],
  properties: ["subject", "smimeStatus"],
});
```

**Find it:** search for `smime`, `hasSmime`, and `hasVerifiedSmime`.

## Package layout

**What changed:** the package ships one bundled entry point,
`dist/index.mjs` with `dist/index.d.mts`, and no source maps. Imports from
`json-meta-client` are unchanged, but deep imports into `dist/` no longer
resolve. The JMAP types that used to be reachable only through deep imports
are exported from the new `json-meta-client/rfc-types` entry point.

```ts
import type {
  Mailbox,
  MethodGet,
} from "json-meta-client/rfc-types";

type MailboxGet = MethodGet.Contract<Mailbox>;
```

**Find it:** search for `json-meta-client/dist`.

## New in 1.0

These additions don't break existing code, but they may replace workarounds:

- [`webSocketTransport()`](./advanced/transports.md) and the `transport`
  option, for the JMAP WebSocket subprotocol.
- `client[Symbol.dispose]()`, so a client can be declared with `using`.
- [`generateMethodCallId`](./reference/api.md#generatemethodcallid-optional),
  for custom method call IDs.
- Built-in `quota`, `sharing`, `mdn`, and `smime` capabilities, and
  `dependsOn` for custom capabilities.
- One shared push channel for every `onStateChange()` handler.

The [changelog](https://github.com/htunnicliff/json-meta-client/blob/main/CHANGELOG.md)
lists every change in each pre-release.
