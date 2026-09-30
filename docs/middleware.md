# Middleware and logging

Middleware transforms API method arguments before they are queued. Supply an
ordered array of synchronous functions in the client's `middleware` option.
Each function receives the previous function's JSON value and returns the value
for the next one.

The optional second argument, `MethodCallContext`, contains the full JMAP method
name, such as `Email/query`. Both `Middleware` and `MethodCallContext` are public
types. Middleware operates on method arguments; HTTP requests, responses, and
authentication headers are outside its scope. Blob operations and event
subscriptions also bypass it.

## Built-in transformations

Before your functions run, the client converts result references to JMAP `#`
arguments and adds a lazy `accountId` getter where neither `accountId` nor
`#accountId` is present. That getter reads the session's primary mail account.
`Core.echo` skips account injection.

An explicit account ID avoids the getter. If your middleware copies or reads
all argument properties, load the session first: reading the getter before
discovery completes can throw. The following example waits for discovery before
copying arguments to override the account:

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

Transform the argument value passed to your function and return valid protocol
data. Changes affect the arguments sent to the server. Async middleware is
unsupported.

## Handling middleware errors

A middleware exception is thrown synchronously when the method is called, before
its pending promise is returned. It keeps its original identity and leaves
earlier queued calls unaffected. Put both the method call and its `await` inside
a `try` block to catch middleware exceptions and request failures. An already
aborted signal skips middleware; see [cancellation](cancellation.md).

## Logging

`logger` defaults to `console`. A custom logger must provide `error`, `warn`,
`info`, and `debug` methods. The client currently uses it to warn about configured
capabilities absent from the initial session. Request failures propagate through
promises rather than an HTTP tracing interface.

Keep bearer tokens and message contents out of application logs.
