# Method Calls

## Calling methods

Every JMAP method is a function on `client.api`. The entity and method names
map directly onto the JMAP method name, so `client.api.Mailbox.query()` makes
a `Mailbox/query` call:

```ts
const mailboxes = await client.api.Mailbox.query({
  filter: { role: "inbox" },
});
```

The general shape is `client.api.<Entity>.<method>(args, options?)`. The
arguments and the result are typed by the
[capabilities](./capabilities.md) the client is configured with: a client
configured with `"mail"` knows the arguments `Email/query` accepts and the
shape of its response, while a client without it has no `client.api.Email`
at all.

When a method has no required arguments once the client fills in
`accountId`, as with most `/get` and `/query` calls, you can leave the
arguments out:

```ts
const identities = await client.api.Identity.get();
```

This is the same as passing `{}`. To pass `options` without arguments, give
`undefined` as the arguments.

At runtime, `client.api` is a proxy, so it doesn't hold a list of methods.
It does check the entity: a call on an entity that no configured capability
declares (or `core`, which is always on) rejects with
[`UnknownEntityError`](../reference/errors.md) and is never sent. Method
names on a known entity aren't checked at runtime; the server answers an
unknown one with an `unknownMethod` error.

## Account IDs

Most JMAP methods take an `accountId`. When a call leaves it out, the client
fills it in from the capability that owns the method, such as `contacts` for
`ContactCard` calls. It uses, in order:

1. The session's primary account for that capability's URN,
   `session.primaryAccounts[urn]`.
2. Otherwise, the only account whose `accountCapabilities` list that URN.

If no account lists the URN, the call is sent without `accountId`, and the
server decides how to answer it. If several accounts list it and the session
names no primary account, the client can't choose: only that call rejects
with `ConfigurationError`, whose message names the method and the URN. The
call is left out of the request, and the rest of the batch still goes ahead.
Pass `accountId` to choose an account yourself.

An `accountId` you pass is always kept, and it can be a result reference.
Calls in one batch can also target different accounts: the primary accounts
for mail and contacts, for example, need not be the same. When one call's
result feeds another and both must use the same account, pass `accountId` on
one side, or reference the other call's `accountId`:

```ts
const session = await client.session;
const [, sharedAccountId] = Object.keys(session.accounts);

const sharedInbox = client.api.Mailbox.query({
  accountId: sharedAccountId!,
  filter: { role: "inbox" },
});

const sharedMailboxes = await client.api.Mailbox.get({
  // Read from the account that the query searched
  accountId: sharedInbox.resultRef("/accountId"),
  ids: sharedInbox.resultRef("/ids"),
});
```

A few methods never get a default:

- `Blob/copy`, because its `accountId` is the destination of the copy and
  nothing in the call says which account that should be.
- `Core/echo` and `PushSubscription` calls, which aren't scoped to an
  account.

A [custom capability](../advanced/extending.md#default-account) chooses its
defaults with the `defaultAccount` setting.

The client picks the account when the batch is sent, after the session has
loaded. Until then, the call's [`$args`](#call-metadata) has no `accountId`;
afterwards it does, and so do the requests that
[`beforeJmapRequest` hooks](../advanced/hooks.md) see.

## Getting results

Each method call returns a promise for the method's response:

```ts
const { ids, total } = await client.api.Email.query({
  filter: { notKeyword: "$seen" },
  calculateTotal: true,
});
```

Calls made in the same tick are collected into a batch and sent together
in one request. To batch several calls, make them all before awaiting any
of them. See [Batching](../advanced/batching.md) for how that works.

## Selecting properties

`/get` methods take an optional `properties` list. When you pass one, each
item of `list` is typed with only those properties; when you don't, it has
the method's default properties. `id` is always included, since JMAP
servers return it whether or not it is requested.

```ts
const recent = client.api.Email.query({ limit: 5 });

const subjects = await client.api.Email.get({
  ids: recent.resultRef("/ids"),
  properties: ["subject", "receivedAt"],
});

for (const email of subjects.list) {
  console.log(email.id, email.subject, email.receivedAt);
  // email.from is a type error: it wasn't requested
}
```

`Email/get` also narrows its body parts. With `bodyProperties`, the parts in
`bodyStructure`, `textBody`, `htmlBody`, and `attachments` are typed with only
the properties you name:

```ts
const withAttachments = await client.api.Email.get({
  ids: recent.resultRef("/ids"),
  properties: ["attachments"],
  bodyProperties: ["blobId", "name", "type", "size"],
});
```

### Header properties

`Email/get` can also return any header field, parsed into one of the forms
that RFC 8621 section 4.1.2 defines. Name the property
`header:{name}:{form}`, and add `:all` to get every instance of the header
rather than only the last one. Each property is typed from its form:

| Form                 | Value                 |
| -------------------- | --------------------- |
| `asRaw` (no form)    | `string`              |
| `asText`             | `string`              |
| `asAddresses`        | `EmailAddress[]`      |
| `asGroupedAddresses` | `EmailAddressGroup[]` |
| `asMessageIds`       | `string[] \| null`    |
| `asDate`             | `string \| null`      |
| `asURLs`             | `string[] \| null`    |

A header named without `:all` is `null` when the email doesn't have it.
With `:all`, the value is a list with one entry per instance, which is
empty when the header is absent.

```ts
const headers = await client.api.Email.get({
  ids: recent.resultRef("/ids"),
  properties: [
    "header:List-Unsubscribe:asURLs",
    "header:Received:asText:all",
    "header:X-Spam-Status",
  ],
});

for (const email of headers.list) {
  const unsubscribe: string[] | null =
    email["header:List-Unsubscribe:asURLs"];
  const received: string[] =
    email["header:Received:asText:all"];
  // No form means asRaw
  const spamStatus: string | null =
    email["header:X-Spam-Status"];
  console.log(unsubscribe, received.length, spamStatus);
}
```

`bodyProperties` takes `header:` properties too, typed the same way on each
body part. When creating an email, a `header:` property takes a value of its
form, never `null`:

```ts
await client.api.Email.set({
  create: {
    draft: {
      mailboxIds: { drafts: true },
      subject: "Weekly update",
      "header:List-Id:asText":
        "Team updates <updates.example.com>",
      "header:Keywords:asText:all": ["status", "weekly"],
    },
  },
});
```

The value types are exported from `json-meta-client/rfc-types` as
`EmailHeaderForms`, and `EmailHeaderValue<Property>` gives the value of a
property name.

## Result references

A result reference passes part of one call's result into another call's
arguments, inside the same request. The server resolves it, so the second
call needs no extra round trip. Create one with `resultRef()` and a
[JSON Pointer](https://www.rfc-editor.org/rfc/rfc6901) into the source
call's result:

```ts
const unread = client.api.Email.query({
  filter: { notKeyword: "$seen" },
  limit: 10,
});

const unreadEmails = await client.api.Email.get({
  ids: unread.resultRef("/ids"),
  properties: ["subject", "from"],
});
```

In the request, the reference replaces the argument's value, and the
argument's name gets a `#` prefix. These are the arguments of the
`Email/get` call above:

```json
{
  "#ids": {
    "name": "Email/query",
    "resultOf": "Email/query::1a2b3c4d",
    "path": "/ids"
  },
  "properties": ["subject", "from"],
  "accountId": "<account-id>"
}
```

`name` is the source call's method, `resultOf` is its method call ID, and
`path` is the pointer. The server replaces the reference with the value
it points to before running the call.

The pointer is type-checked against the source call's result, including the
`*` wildcard that maps over an array, as in `"/list/*/threadId"`. The value
it points to is checked against the argument's type, so a pointer to a
number can't be passed where a list of IDs is expected.

A reference must be a whole, top-level argument, and the source call must
be in the same batch. A call that breaks a rule rejects with
[`ResultReferenceError`](../reference/errors.md) before it is sent.

One call can be referenced any number of times. Here a single search feeds
both the emails and their highlighted search snippets:

```ts
const filter = { text: "invoice" };
const matches = client.api.Email.query({ filter });

const [found, snippets] = await Promise.all([
  client.api.Email.get({
    ids: matches.resultRef("/ids"),
    properties: ["subject"],
  }),
  client.api.SearchSnippet.get({
    filter,
    emailIds: matches.resultRef("/ids"),
  }),
]);
```

## Creation references

When you create objects with a `/set` call, you give each one a creation
ID: its key in `create`. Other calls in the same request can refer to an
object before it exists by passing that ID to `createdRef()`, which returns
`"#"` followed by the ID. This example creates a draft and sends it in one
request, given the ID of the drafts mailbox:

```ts
const draftsMailboxId = (
  await client.api.Mailbox.query({
    filter: { role: "drafts" },
  })
).ids[0]!;
```

```ts
const identity = (await client.api.Identity.get()).list[0]!;

const draft = client.api.Email.set({
  create: {
    hello: {
      keywords: { $draft: true },
      mailboxIds: { [draftsMailboxId]: true },
      from: [
        { name: identity.name, email: identity.email },
      ],
      to: [{ name: null, email: "someone@example.com" }],
      subject: "Hello",
    },
  },
});

void client.api.EmailSubmission.set({
  create: {
    send: {
      // The ID of the email that `draft` creates
      emailId: draft.createdRef("hello"),
      identityId: identity.id,
    },
  },
});
```

`createdRef()` exists only on `/set` calls. The creation ID is checked
against the keys of `create`, both in the types and at runtime. The server
only knows a creation ID while it processes the request that creates it, so
the call that uses the reference must be in the same batch. Call
`createdRef()` before awaiting the `/set` call, and make the calls that use
it before awaiting anything else. The
[Send an email](../examples.md#send-an-email) example puts this together.

RFC 8620 shares one set of creation IDs between every call in a request,
whatever the type. Batching can put unrelated code in the same request, so
pick creation IDs that won't collide, such as ones with a prefix for each
feature.

A creation reference resolves only where the RFC, or the extension that
defines a method, says it does: for example in the objects of a `/set`
call's `create` and `update`, or in `onSuccessUpdateEmail` in
`EmailSubmission/set`. Elsewhere, such as in the `ids` of a `/get` call,
whether it resolves is up to the server. A result reference to the `/set`
call's `/created/<id>/id` works anywhere a result reference does.

The client throws, or rejects the call, with a
[`CreationReferenceError`](../reference/errors.md#creationreferenceerror)
when:

- `createdRef()` is given an ID that isn't a key of `create`.
- `createdRef()` is called after the `/set` call's batch was sent.
- A `/set` or `/copy` call, or `Email/import`, reuses a creation ID from an
  earlier call in the same batch. The call rejects without being sent, and
  the rest of its batch proceeds.

## Patch updates

The `update` argument of a `/set` call takes a patch object for each ID, as
in JMAP. Each key names a property, and its value is the property's whole
new value. This moves the email out of every other mailbox and into the
archive:

```ts
const email = subjects.list[0]!;
const [inbox, archive] = await Promise.all([
  client.api.Mailbox.query({ filter: { role: "inbox" } }),
  client.api.Mailbox.query({ filter: { role: "archive" } }),
]);
const inboxId = inbox.ids[0]!;
const archiveId = archive.ids[0]!;

await client.api.Email.set({
  update: {
    [email.id]: { mailboxIds: { [archiveId]: true } },
  },
});
```

A `null` value removes a property. The keys and values are typed, so a
misspelled property or a value of the wrong type is a type error.

### Change only some keys

To change some keys of an object and leave the rest, wrap them in
`patch()`. This adds the email to the archive, takes it out of the inbox,
and marks it as read, without touching its other mailboxes or keywords:

```ts
import { patch } from "json-meta-client";

await client.api.Email.set({
  update: {
    [email.id]: {
      mailboxIds: patch({
        [archiveId]: true,
        [inboxId]: null,
      }),
      keywords: patch({ $seen: true }),
    },
  },
});
```

`null` removes a key. The client sends each key as the JSON Pointer path
JMAP expects, so the update it sends is
`{ "mailboxIds/<archive-id>": true, "mailboxIds/<inbox-id>": null, "keywords/$seen": true }`.
It escapes `~` and `/` in each key as `~0` and `~1`, so IDs and keywords
can be used as they are. Because the keys are in an object, IDs from a
variable keep their types, and a value the map doesn't accept, such as
`false` in `mailboxIds`, is a type error.

Inside `patch()`, values are whole values again. To patch a level further
down, nest another `patch()`, as in `name: patch({ full: "Jane" })`.

### JSON Pointer paths

You can also write the paths yourself. A key that contains `/` is sent as
it is, and the types expect it in its escaped form:

```ts
await client.api.Email.set({
  update: {
    [email.id]: {
      "keywords/$seen": true,
      "keywords/$flagged": null,
    },
  },
});
```

A path built from a variable, as in ``[`mailboxIds/${archiveId}`]``, loses
its type, because TypeScript types the key as a plain `string`. Use
`patch()` instead, or [`patchMap()`](../reference/api.md#patchmap), which
builds the same paths as a standalone patch object:

```ts
import { patchMap } from "json-meta-client";

await client.api.Email.set({
  update: {
    [email.id]: {
      ...patchMap("mailboxIds", { [archiveId]: true }),
      "keywords/$seen": true,
    },
  },
});
```

Arrays are always replaced whole, so a path can't point inside one. To
change an array, send the whole new array. This adds an address to an
identity's `bcc` list:

```ts
const sender = (await client.api.Identity.get()).list[0]!;

await client.api.Identity.set({
  update: {
    [sender.id]: {
      bcc: [
        ...(sender.bcc ?? []),
        { name: null, email: "archive@example.com" },
      ],
    },
  },
});
```

## Call metadata

Every pending call carries its details, available before it is sent:

- `$id`: the method call ID
- `$method`: the method name, such as `"Email/get"`
- `$args`: the arguments as they will be sent

```ts
const probe = client.api.Core.echo(
  { hello: "world" },
  { id: "probe" },
);

console.log(probe.$id); // "probe"
console.log(probe.$method); // "Core/echo"
console.log(probe.$args); // { hello: "world" }
```

The `{ id }` option sets the method call ID for one call. To change how the
client generates IDs for every call, configure
[`generateMethodCallId`](../reference/api.md#generatemethodcallid-optional).

## Method errors

When one method in a batch fails, only that call rejects, with a
[`JmapError`](../reference/errors.md) whose `type` is the JMAP error type.
The other calls in the batch still resolve:

```ts
import { isJmapError } from "json-meta-client";

const [inboxes, sorted] = await Promise.allSettled([
  client.api.Mailbox.query({ filter: { role: "inbox" } }),
  // Servers reject sorting on a property they don't support
  client.api.Email.query({
    sort: [{ property: "size", isAscending: false }],
  }),
]);

if (
  sorted.status === "rejected" &&
  isJmapError(sorted.reason)
) {
  console.error(sorted.reason.type); // e.g. "unsupportedSort"
}
// `inboxes` is unaffected by the failure
```

The [Errors reference](../reference/errors.md) lists every error class and
when each is thrown.
