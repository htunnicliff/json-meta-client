# Method Calls

Use `client.api.Entity.method(args)` to invoke `Entity/method`: for example,
`client.api.Email.query(...)` invokes `Email/query`. Configured
[capabilities](./capabilities.md) determine the entities and methods available to
TypeScript. Core is automatic; mail and submission are opt-in.

## Query, get, and set

`query` returns matching **IDs**, `get` returns **objects**, and `set` creates,
updates, or destroys objects. This example finds an inbox, selects mailbox
properties, and updates one preference. The account must allow mailbox updates.

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  auth: { token: "YOUR_ACCESS_TOKEN" },
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  capabilities: ["mail", "submission"],
});
const session = await client.session;
const accountId =
  session.primaryAccounts["urn:ietf:params:jmap:mail"];
if (
  !accountId ||
  !session.accounts[accountId]?.accountCapabilities[
    "urn:ietf:params:jmap:mail"
  ]
) {
  throw new Error("No primary mail account is available");
}

const query = await client.api.Mailbox.query({
  accountId,
  filter: { role: "inbox" },
  limit: 1,
});
const inboxId = query.ids[0];
if (!inboxId) throw new Error("No inbox found");
const mailboxes = await client.api.Mailbox.get({
  accountId,
  ids: [inboxId],
  properties: ["id", "name", "isSubscribed"],
});
const inbox = mailboxes.list[0];
if (!inbox)
  throw new Error("The inbox is no longer readable");
console.log(inbox.name, inbox.isSubscribed);

const changed = await client.api.Mailbox.set({
  accountId,
  update: { [inbox.id]: { isSubscribed: true } },
});
if (changed.notUpdated?.[inbox.id]) {
  throw new Error(
    JSON.stringify(changed.notUpdated[inbox.id]),
  );
}
if (
  !changed.updated ||
  !Object.hasOwn(changed.updated, inbox.id)
) {
  throw new Error("The server did not confirm the update");
}
```

`properties` limits the returned fields and narrows their TypeScript types.
Include each field you consume; IDs are always returned. An omitted or `null`
`ids` in a standard `get` requests all accessible objects; `ids: []` requests none.
Check `list` for empty results and `notFound` for requested IDs that disappeared.
For `set`, a resolved promise can still contain `notCreated`, `notUpdated`, or
`notDestroyed`; inspect these per-object errors before treating a write as successful.
See the [error contract](../reference/errors.md).

These standard operations follow [RFC 8620 §5](https://jmap.io/spec/rfc8620/#section-5).
Mail-specific fields and operations follow
[RFC 8621](https://jmap.io/spec/rfc8621/).

## Pending calls and awaited results

Calling a method immediately queues it and returns a promise augmented with
`resultRef()`, `$id`, `$method`, and `$args`. A pending `set` also has
`createdRef()`. Awaiting the promise returns the response arguments object,
without those pending-call helpers. Save the pending call when building references.

Calls created synchronously before the next queue flush can share a request.
Sequential awaits create separate requests. See [Batching](../advanced/batching.md)
for the microtask boundary, isolation, limits, and cancellation.

## Select an account

If the arguments omit `accountId`, the client injects
`session.primaryAccounts["urn:ietf:params:jmap:mail"]`. It uses this mail default
even for another capability's methods. It does not search for a suitable account
or verify its permissions. For shared, secondary, contacts-only, or submission
accounts, select the appropriate session account and pass its ID explicitly.
Passing `accountId: undefined` prevents default injection; omit the property
when you intend to use the default.

Inspect `session.accounts[accountId].accountCapabilities` for every required
capability. For a mail/submission workflow, choose one account supporting both;
its primary mail and primary submission IDs need not be the same. See
[Capabilities](./capabilities.md) and [Examples](../examples.md#send-an-email).

## Reference a previous result

`resultRef(path)` creates a JMAP result-reference object. The producer must precede
the consumer **in the same request**. Do not await between creating these calls.
The library transforms a reference passed as `ids` into a `#ids` argument; the
server resolves it, rather than fetching the producer's result in JavaScript.

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  auth: { token: "YOUR_ACCESS_TOKEN" },
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  capabilities: ["mail", "submission"],
});
const session = await client.session;
const accountId =
  session.primaryAccounts["urn:ietf:params:jmap:mail"];
if (
  !accountId ||
  !session.accounts[accountId]?.accountCapabilities[
    "urn:ietf:params:jmap:mail"
  ]
) {
  throw new Error("No primary mail account is available");
}

const query = client.api.Email.query(
  {
    accountId,
    filter: { notKeyword: "$seen" },
    limit: 10,
  },
  { id: "unread-query" },
);
const get = client.api.Email.get(
  {
    accountId,
    ids: query.resultRef("/ids"),
    properties: ["id", "subject"],
  },
  { id: "unread-get" },
);
const [matches, emails] = await Promise.all([query, get]);
console.log(matches.ids, emails.list, emails.notFound);
```

The matching request is shown below with `ACCOUNT_ID` substituted for the selected
account. Explicit invocation IDs in the example make the reference reproducible.
Use unique invocation IDs within each request.

```json
{
  "using": [
    "urn:ietf:params:jmap:core",
    "urn:ietf:params:jmap:mail"
  ],
  "methodCalls": [
    [
      "Email/query",
      {
        "accountId": "ACCOUNT_ID",
        "filter": { "notKeyword": "$seen" },
        "limit": 10
      },
      "unread-query"
    ],
    [
      "Email/get",
      {
        "accountId": "ACCOUNT_ID",
        "#ids": {
          "name": "Email/query",
          "resultOf": "unread-query",
          "path": "/ids"
        },
        "properties": ["id", "subject"]
      },
      "unread-get"
    ]
  ]
}
```

Paths are JSON Pointers into response **arguments**: `/ids` reads a query's IDs,
`/list/0/id` reads the first returned object's ID, and `/list/*/id` collects every
object's ID. JMAP adds `*` array traversal to JSON Pointer; escape property-name
`~` and `/` as `~0` and `~1` at the protocol level. The typed helper validates paths
against known output fields and infers the referenced value's type; it does not
fetch or check the actual response. Some escaped property-name paths are not
expressible by its current type-level path generator. A missing path, failed
producer, or type-incompatible value can produce `invalidResultReference`.
The protocol rules are in
[RFC 8620 §3.7](https://jmap.io/spec/rfc8620/#section-3.7).

For example, collect IDs from a `get` response:

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  auth: { token: "YOUR_ACCESS_TOKEN" },
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  capabilities: ["mail", "submission"],
});
const session = await client.session;
const accountId =
  session.primaryAccounts["urn:ietf:params:jmap:mail"];
if (
  !accountId ||
  !session.accounts[accountId]?.accountCapabilities[
    "urn:ietf:params:jmap:mail"
  ]
) {
  throw new Error("No primary mail account is available");
}

const mailboxes = client.api.Mailbox.get({
  accountId,
  ids: null,
  properties: ["id", "name"],
});
const refresh = client.api.Mailbox.get({
  accountId,
  ids: mailboxes.resultRef("/list/*/id"),
  properties: ["id", "name", "totalEmails"],
});
const [, result] = await Promise.all([mailboxes, refresh]);
console.log(result.list);
```

## Reference a newly created object

A creation ID is a request-local key in a `set` call's `create` map.
`createdRef("key")` returns `"#key"` and checks the key exists in that call's
`create` map. It does not confirm that creation succeeds. Keep creation IDs unique
across the request and use references only where the protocol accepts them.

This creates a parent mailbox and then its child in the same request:

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  auth: { token: "YOUR_ACCESS_TOKEN" },
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  capabilities: ["mail", "submission"],
});
const session = await client.session;
const accountId =
  session.primaryAccounts["urn:ietf:params:jmap:mail"];
if (
  !accountId ||
  !session.accounts[accountId]?.accountCapabilities[
    "urn:ietf:params:jmap:mail"
  ]
) {
  throw new Error("No primary mail account is available");
}

const parent = client.api.Mailbox.set({
  accountId,
  create: { project: { name: "Project" } },
});
const child = client.api.Mailbox.set({
  accountId,
  create: {
    tasks: {
      name: "Tasks",
      parentId: parent.createdRef("project"),
    },
  },
});
const [parents, children] = await Promise.all([
  parent,
  child,
]);
if (!parents.created?.project || !children.created?.tasks) {
  throw new Error(
    JSON.stringify({
      parent: parents.notCreated,
      child: children.notCreated,
    }),
  );
}
console.log(children.created.tasks.id);
```

Creation references follow
[RFC 8620 §5.3](https://jmap.io/spec/rfc8620/#section-5.3). If you await creation
first, pass its returned `created.key.id` as a literal ID in the later request.
For mail creation followed by submission, see the complete
[send recipe](../examples.md#send-an-email).
