# Middleware and logging

`middleware` is an ordered array of synchronous argument
transformations. Each function receives a JSON value and returns
the value passed to the next function. It runs when you call an API
method, before the method is queued. Its optional second argument is
`MethodCallContext`, containing `method`, such as `Email/query`.
It does not receive the HTTP request, response, or authentication
headers. `Middleware` and `MethodCallContext` are public types.

Built-in transformations run first: result-reference arguments
become their JMAP `#` form, and missing `accountId` is given a lazy
primary-mail-account value for ordinary account-scoped calls.
`Core.echo` is account-free and skips account injection. Your middleware runs afterward.

```ts
import { Client } from "json-meta-client";
import { mail } from "json-meta-client/capabilities";

const client = new Client({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  bearerToken: "<token>",
  capabilities: [mail],
  middleware: [
    (payload) => {
      if (payload !== null && typeof payload === "object" && !Array.isArray(payload)) {
        return Object.assign({}, payload, { accountId: "<shared-account-id>" });
      }
      return payload;
    },
  ],
});
await client.session;
const query = await client.api.Email.query({ limit: 10 });
```

Awaiting the session before this example's object copy ensures
that reading the lazily supplied `accountId` can succeed. Reading
that account value before the session loads can throw. Explicit
account IDs avoid the lazy getter. Treat arguments as the value
being transformed rather than inspecting pending metadata after
queuing. Middleware can alter wire arguments and is responsible
for returning valid protocol data. Async middleware is unsupported.

A middleware exception occurs synchronously at the method call,
before a pending call is returned; it is not a JMAP method error.
It cannot reject earlier calls that were already queued. To handle
both middleware errors and request rejection, put both the method
call and its `await` inside a `try` block. `client.blob` operations
and event subscriptions do not pass through method middleware.

`logger` defaults to `console` and must supply `error`, `warn`,
`info`, and `debug` methods when provided. The current client uses
it to warn about configured capabilities missing from the initial
session. It is not an HTTP tracing interface, and changing the
logger does not change error propagation. Avoid logging bearer
tokens or message contents in your application.
