# JSON Meta Client

Build JMAP requests with ordinary TypeScript method calls. JSON Meta Client handles session discovery, authentication headers, request batching, and matching each response to its caller.

[JMAP](https://jmap.io/) defines methods for accessing data such as mailboxes and messages. Your server decides which extensions it supports; the client supplies types and an HTTP interface to those methods.

::: warning Alpha release
The API is still evolving. Check release notes when upgrading.
:::

## Your first request

The [getting started guide](./introduction/getting-started.md) walks through installation, credentials, and fetching mail. Once a client is configured, a method call looks like this:

```ts
const result = await client.api.Mailbox.get({});

for (const mailbox of result.list) {
  console.log(mailbox.name);
}
```

The result contains the method's response arguments. Session loading and the JMAP request envelope are handled for you.

## Let the server connect the calls

A query returns IDs; a get call retrieves their records. Create both calls together and pass a reference between them:

```ts
const query = client.api.Email.query({ limit: 5 });
const messages = await client.api.Email.get({
  ids: query.ref("/ids"),
  properties: ["subject"],
});

console.log(messages.list);
```

Both methods travel in one API request. The server resolves the reference after running the query. Learn the timing rules in [Batching](./features/batching.md) and the pointer syntax in [Result references](./features/result-references.md).

## Find your way around

| You want to…                      | Read                                                 |
| --------------------------------- | ---------------------------------------------------- |
| Connect to a provider             | [Getting started](./introduction/getting-started.md) |
| Read an inbox or update a message | [Examples](./introduction/examples.md)               |
| Choose accounts and call methods  | [Method calls](./features/method-calls.md)           |
| Enable a server extension         | [Capabilities](./features/capabilities.md)           |
| Transfer files                    | [Blobs](./features/blobs.md)                         |
| Respond to changes                | [Events](./features/events.md)                       |
| Customize HTTP requests           | [Hooks](./features/hooks.md)                         |
| Look up a signature               | [Client API](./reference/client-api.md)              |
| Diagnose a failure                | [Errors](./reference/errors.md)                      |

Examples use TypeScript and modern Web APIs. JavaScript applications use the same runtime API, without compile-time argument and response checking.
