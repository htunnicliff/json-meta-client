# JSON Meta Client

JSON Meta Client is a TypeScript JMAP client for Node.js and the browser. Call JMAP methods through a typed API, group calls into a single HTTP request, and use one call’s result as another call’s input.

[JMAP](https://jmap.io/) is a protocol for working with data such as email, mailboxes, and contacts. Your provider determines which capabilities and methods are available.

::: warning Alpha software
The library is in alpha. Its API may change between releases.
:::

## Start Here

Follow [Getting Started](./introduction/getting-started.md) to install the package and make your first request. You’ll need a JMAP provider’s session URL and a bearer token.

## Query and Fetch in One Request

With a client configured for the `mail` capability:

```ts
const query = client.api.Email.query({ limit: 10 });
const get = client.api.Email.get({
  ids: query.ref("/ids"),
  properties: ["subject", "from"],
});
const [, emails] = await Promise.all([query, get]);

for (const email of emails.list) {
  console.log(email.subject);
}
```

The query is deliberately created without `await`. Both calls enter the same [batch](./features/batching.md), and the server resolves the [result reference](./features/result-references.md) before fetching the emails.

## Explore the Docs

- [Examples](./introduction/examples.md): find an inbox, read emails, and watch for changes.
- [Capabilities](./features/capabilities.md): choose built-in capabilities or define your own.
- [Client API](./reference/client-api.md): look up methods and return values.
- [Errors](./reference/errors.md): handle failed requests and method calls.
