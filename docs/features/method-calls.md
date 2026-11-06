# Read and change objects

Call a JMAP method through `client.api.Entity.method(arguments)`. For example,
`client.api.Email.get(...)` sends `Email/get`. The capabilities you configure
determine the methods TypeScript exposes; [choose those capabilities](./capabilities.md)
before following the examples below.

Most object operations follow the same pattern: `query` finds IDs, `get` reads
objects, and `set` creates, updates, or destroys them. The examples use an
explicit `ACCOUNT_ID`; replace it with an account selected from your session.

## Read the fields you need

Pass IDs to `get` and name the fields your code will use in `properties`:

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail"],
});

const result = await client.api.Email.get({
  accountId: "ACCOUNT_ID",
  ids: ["EMAIL_ID"],
  properties: ["id", "subject", "from"],
});
for (const email of result.list) {
  console.log(email.id, email.subject, email.from);
}
if (result.notFound?.length) {
  console.warn(
    "Messages are no longer readable",
    result.notFound,
  );
}
```

`list` contains the readable objects. Requested IDs that cannot be found appear
in `notFound`; a successful call can therefore return fewer objects than you
requested. An empty list is also a valid result.

The result type follows `properties`, so accessing an unselected field is a type
error. Standard get responses always include the object's ID. For standard get
methods, omitting `ids` or passing `null` requests all accessible objects;
`ids: []` requests none. Use bounded queries for large collections rather than
requesting everything at once.

## Reference a previous result

When a query supplies the IDs for a get, use a result reference to run both in
one request. Create the query first, pass its reference to the get, and then
await both calls together:

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail"],
});

const query = client.api.Email.query({
  accountId: "ACCOUNT_ID",
  filter: { notKeyword: "$seen" },
  limit: 10,
});
const get = client.api.Email.get({
  accountId: "ACCOUNT_ID",
  ids: query.resultRef("/ids"),
  properties: ["id", "subject"],
});
const [, emails] = await Promise.all([query, get]);
console.log(emails.list);
```

`query` is a pending call: a promise with reference helpers attached.
`query.resultRef("/ids")` describes where to find the IDs in that call's result.
The client sends it as a `#ids` argument, and the server resolves it before
running the get. No query result has to travel back to your application first.

Keep both calls in the same queue and create them without an intervening await.
A reference cannot reach into an earlier HTTP request or another isolated queue.
If you have already awaited the query, pass its returned `ids` array instead.
The [batching guide](../advanced/batching.md) explains when queues flush.

A reference path is a JSON Pointer into the method's response arguments:

| Path         | Value selected                             |
| ------------ | ------------------------------------------ |
| `/ids`       | The IDs from a query.                      |
| `/list/0/id` | The first object's ID from a get.          |
| `/list/*/id` | An array of IDs from all objects in a get. |

The `*` traversal is a JMAP extension to JSON Pointer. The helper checks paths
against the known result type and carries the selected value's type into the
next call. It cannot check the actual response: a failed producer, a missing
path, or an incompatible value can still cause `invalidResultReference` on the
server. JSON Pointer escapes `~` and `/` in property names as `~0` and `~1`;
some escaped property-name paths cannot be expressed by the current typed helper.

Awaiting a call gives you just its response arguments. Save the pending call if
you need its helpers later. Its `$id`, `$method`, and `$args` fields are described
in the [API reference](../reference/api.md#pending-call-members).

## Update an object and check the outcome

A set call's `update` map uses existing object IDs as keys. This example changes
a mailbox preference; replace `MAILBOX_ID` with a mailbox you can update:

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail"],
});
const mailboxId = "MAILBOX_ID";
const result = await client.api.Mailbox.set({
  accountId: "ACCOUNT_ID",
  update: { [mailboxId]: { isSubscribed: true } },
});

const failure = result.notUpdated?.[mailboxId];
if (failure) throw new Error(JSON.stringify(failure));
if (
  !result.updated ||
  !Object.hasOwn(result.updated, mailboxId)
) {
  throw new Error("The server did not confirm the update");
}
console.log("Subscribed to", mailboxId);
```

A fulfilled promise does not mean every object changed. Inspect `notCreated`,
`notUpdated`, and `notDestroyed` for the operations you requested. Method-wide
failures reject instead; the [error reference](../reference/errors.md)
distinguishes these cases.

## Reference a newly created object

The keys in a set call's `create` map are temporary creation IDs. Use
`createdRef()` to refer to a new object before the server has assigned its real
ID. This creates a parent mailbox and a child in one request:

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail"],
});
const parent = client.api.Mailbox.set({
  accountId: "ACCOUNT_ID",
  create: { project: { name: "Project" } },
});
const child = client.api.Mailbox.set({
  accountId: "ACCOUNT_ID",
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

`parent.createdRef("project")` returns `"#project"`. It checks that `project`
is a key in that call's create map, not that the server will create the object.
Keep creation IDs unique throughout the request, put the producer before its
consumer, and use these references only where the protocol accepts them.

If you await creation first, use the real ID from `created.project.id` in later
requests. For a draft followed by a submission, see [sending mail](../examples.md#send-an-email).
