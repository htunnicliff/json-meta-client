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
const identity = (await client.api.Identity.get({}))
  .list[0]!;

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
against the keys of `create`, both in the types and at runtime, where an
unknown ID throws a `RangeError`. As with result references, the call that
uses the reference must be in the same batch. The
[Send an email](../examples.md#send-an-email) example puts this together.

## Patch updates

The `update` argument of a `/set` call takes a patch object for each ID. Its
keys are paths into the object. Both the paths and their values are typed, so
a misspelled path or a value of the wrong type is a type error:

```ts
const email = subjects.list[0]!;

await client.api.Email.set({
  update: {
    [email.id]: {
      // Set one keyword, leaving the others as they are
      "keywords/$seen": true,
      // Remove a keyword
      "keywords/$flagged": null,
    },
  },
});
```

To replace a whole property, use its name as the path. This moves the email
out of every other mailbox and into the archive:

```ts
const archiveId = (
  await client.api.Mailbox.query({
    filter: { role: "archive" },
  })
).ids[0]!;

await client.api.Email.set({
  update: {
    [email.id]: { mailboxIds: { [archiveId]: true } },
  },
});
```

A `null` value removes a property. Keys that contain `~` or `/` are escaped
as `~0` and `~1`, following JSON Pointer, and the types expect the escaped
form.

Arrays are always replaced whole, so a path can't point inside one. To
change an array, send the whole new array. This adds an address to an
identity's `bcc` list:

```ts
const sender = (await client.api.Identity.get({})).list[0]!;

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
