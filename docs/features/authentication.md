# Authentication

Configure `auth` with Bearer credentials, Basic credentials,
or a callback. Authentication applies to session discovery,
API calls, blob uploads and downloads, and every event-stream
connection, including reconnects.

## Bearer

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://mail.example/.well-known/jmap",
  capabilities: ["mail"],
  auth: { token: "access-token" },
});
```

The client sends `Authorization: Bearer access-token`. The
`token` must be a non-empty string.

## Basic

```ts
const client = new JsonMetaClient({
  sessionUrl: "https://mail.example/.well-known/jmap",
  capabilities: ["mail"],
  auth: {
    username: "user@example.com",
    password: "app-password",
  },
});
```

The client encodes the username and password as UTF-8, then
Base64, and sends `Authorization: Basic ...`. Both fields
must be strings; the username must be non-empty and cannot
contain a colon. An empty password is allowed, and passwords
may contain colons. Use HTTPS and prefer an individual app
password when your server supports one.

The object shape chooses the scheme. Mixing `token` with
`username` or `password`, or supplying incomplete credentials,
throws `ConfigurationError` during construction. Public types
also reject mixed or incomplete credential objects.

## Custom authentication

```ts
const client = new JsonMetaClient({
  sessionUrl: "https://mail.example/.well-known/jmap",
  capabilities: ["mail"],
  auth: async ({ request }) => {
    const token = await getAccessToken(request.url);
    request.headers.set("Authorization", `Bearer ${token}`);
    request.headers.set(
      "X-Proxy-Authorization",
      "proxy-value",
    );
  },
});
```

The exported `AuthCallback` type is
`(args: { request: Request }) => void | Promise<void>`. `Auth`
is the union of the callback and both credential object forms.

The callback receives the outgoing `Request`, including its
URL, method, headers, body, and signal. Mutate it in place;
there is no return value. To inspect a body without consuming
it, read `request.clone()`.

The client invokes and awaits the callback for each request
before sending it. Event-stream reconnects receive a fresh
request with the stream headers, abort signal, and any
`Last-Event-ID`. Changes to that request are sent to the
server. Cached session reads do not send a request; use
`refreshSession()` to fetch again.

Redirects follow the platform's native `fetch` behavior and do
not invoke the callback again for each redirect hop. For
URL-dependent credentials or signatures, use final endpoint
URLs in the client configuration and server session metadata.

Callers own credential acquisition and refresh policy. The
callback supports current tokens, URL-dependent credentials,
request signing, and multiple authentication headers. It does
not implement OAuth sign-in or challenge-response negotiation.
If it throws or rejects, that request is not sent; ordinary
requests reject with the client's request error handling, and
event streams use the transport's reconnect behavior.

## Hook ordering

For every transport, including each event-stream reconnect:

1. Create the request with its transport headers and body.
2. Apply and await `auth`.
3. Run `hooks.beforeRequest` in order, awaiting each hook and
   using its returned request.
4. Send the resulting request.
5. Run `hooks.afterResponse` in order on the received response.

Request hooks can inspect or override authentication headers.
For signing that must include changes made by request hooks,
perform the final signing in the last `beforeRequest` hook.
See [Hooks](../advanced/hooks.md).

## Migrating from bearerToken

This is a breaking configuration change. Replace:

```ts
new JsonMetaClient({
  sessionUrl,
  capabilities,
  bearerToken: token,
});
```

with:

```ts
new JsonMetaClient({
  sessionUrl,
  capabilities,
  auth: { token },
});
```

There is no deprecated alias or compatibility path. If you
previously supplied a dummy token and a request hook for Basic
authentication, replace both with
`auth: { username, password }`. Event-stream connections now
run the same authentication and request/response hooks as
other requests, so hooks should account for stream requests
and responses too.
