# Method calls

JMAP names methods as `Entity/method`. On the client, call them as `client.api.Entity.method(arguments, options)`:

```ts
const result = await client.api.Mailbox.query({
  filter: { role: "inbox" },
  limit: 1,
});

console.log(result.ids);
```

Entity names are case-sensitive. The promise resolves to the response arguments, so `result` above is the query response rather than an HTTP response or JMAP invocation tuple.

## Arguments and accounts

Pass the arguments defined by the method's JMAP specification. The configured [capabilities](./capabilities.md) supply TypeScript contracts; the client does not validate argument values or returned records at runtime.

For methods with an `accountId`, you can usually omit it to use the primary mail account. Choose another account explicitly:

```ts
const result = await client.api.Mailbox.get({
  accountId: "<shared-account-id>",
});
```

Inspect `session.accounts` after `await client.session` to find available accounts. Capability selection does not change the default account, so supply one explicitly for contacts and other extensions when needed.

## What happens when you call a method

The call runs argument middleware and immediately joins the client's queue. A microtask flushes queued calls into an HTTP request; awaiting the promise observes its result rather than starting it.

Create independent calls together to [batch them](./batching.md). For a dependency between two methods, use a [result reference](./result-references.md).

## Identify a pending call

The optional second argument lets you choose a call ID:

```ts
const pending = client.api.Mailbox.get({ properties: ["id", "name"] }, { id: "mailbox-list" });

console.log(pending.$id); // "mailbox-list"
console.log(pending.$method); // "Mailbox/get"

const result = await pending;
```

IDs must be unique within the batch. If omitted, the client creates an ID in the form `<Entity>/<method>::<random-UUID>`.

The promise also has `$args` and `.ref(pointer)`. `$args` exposes the arguments after middleware, including rewritten reference keys. An automatically supplied account ID is a lazy property that needs the session to have loaded before you read it.

These members are attached to the original promise. They are not properties of `result` or of a new promise returned by `.then()`.

## Interpret success and failure

A method error rejects that call. A failure while loading the session or sending the HTTP request can reject all calls in the affected batch. The [error reference](../reference/errors.md) describes the error classes.

A resolved `set` response only means the method itself succeeded. Check its per-record failure maps before telling a user that a record was created, updated, or destroyed.
