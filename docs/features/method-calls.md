# Method Calls

Call a JMAP method with `client.api.<Entity>.<method>(args, options)`. Entity names are case-sensitive; method names match the JMAP protocol.

```ts
const mailboxes = await client.api.Mailbox.query({
  filter: { role: "inbox" },
  limit: 1,
});

console.log(mailboxes.ids);
```

The promise resolves to the method’s response arguments, such as `ids` or `list`. You do not need to unpack the JMAP invocation tuple or HTTP response.

The configured [capabilities](./capabilities.md) determine the methods TypeScript offers. The client does not validate method arguments or response records at runtime.

## Accounts

If you omit `accountId`, the client supplies the session’s primary mail account. Pass an explicit account ID for shared accounts or capabilities that use a different account:

```ts
const result = await client.api.Mailbox.get({ accountId: "<account-id>" });
```

## Call IDs and Metadata

The optional second argument accepts an `id`. Use a unique ID for each call in a batch:

```ts
const pending = client.api.Mailbox.get({}, { id: "get-mailboxes" });

console.log(pending.$id); // "get-mailboxes"
console.log(pending.$method); // "Mailbox/get"

const result = await pending;
```

Without an explicit ID, the client generates `<Entity>/<method>::<random-UUID>`. The pending promise also exposes `$args`, the arguments after middleware has run. The automatically injected account ID is resolved lazily; await the session before reading it from `$args`.

Metadata and `.ref()` belong to the pending promise, rather than its resolved value. See [Result References](./result-references.md) to pass results between calls in the same request.

## Responses and Errors

A method-level error rejects that call’s promise. A transport failure can reject every call in a batch. See [Errors](../reference/errors.md).

A successful `set` response can still contain failures for individual records. Check fields such as `notCreated`, `notUpdated`, and `notDestroyed`; those failures do not reject the promise.
