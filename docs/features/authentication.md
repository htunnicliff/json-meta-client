# Authenticate requests

Set `auth` when you create the client. The client applies those credentials to
session requests, JMAP calls, blob transfers, and event-stream connections,
including reconnects.

Choose the form your provider accepts: a bearer token, a username and password,
or a callback that prepares each request. The client sends credentials you
provide; your application is responsible for obtaining and refreshing them.

## Use a bearer token

Pass the token in `auth.token`:

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail"],
});
```

Every request carries `Authorization: Bearer YOUR_ACCESS_TOKEN`. The token must
be a non-empty string. Use your provider's token acquisition flow and keep the
token out of committed files.

## Use a username and password

For a provider that accepts HTTP Basic authentication, pass both fields. Use
HTTPS: Base64 encoding does not protect the password in transit.

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: {
    username: "user@example.com",
    password: "YOUR_APP_PASSWORD",
  },
  capabilities: ["mail"],
});
```

The client encodes the pair as UTF-8 and Base64 for the `Authorization: Basic`
header. The username must be non-empty and cannot contain a colon. The password
can be empty or contain colons. If your provider offers individual app
passwords, use one intended for this application.

Use one credential form at a time. Mixing a token with username/password fields,
or omitting a required field, throws `ConfigurationError` during construction.

## Use current credentials for each request

Use an authentication callback when a token can change during the client's
lifetime, when different URLs need different credentials, or when you need to
sign requests. This factory accepts your application's token function:

```ts
import { JsonMetaClient } from "json-meta-client";

export function createClient(
  getToken: () => Promise<string>,
) {
  return new JsonMetaClient({
    sessionUrl: "https://jmap.example.com/.well-known/jmap",
    capabilities: ["mail"],
    auth: async ({ request }) => {
      const token = await getToken();
      request.headers.set(
        "Authorization",
        `Bearer ${token}`,
      );
    },
  });
}
```

The client awaits the callback before sending each request. Mutate the supplied
`Request` in place and return nothing. You can inspect its URL, method, headers,
body, and signal; read `request.clone()` if you need to inspect the body without
consuming it. If the callback fails, that request is not sent.

Event-stream reconnects call the callback again with a fresh request, including
stream headers and any `Last-Event-ID`. Reading an already cached session sends
no request, so it does not call the callback. `refreshSession()` fetches again.

The callback does not implement OAuth sign-in or challenge-response negotiation.
Your application owns that policy, including coordinating token refreshes when
several requests need credentials at once. Redirects follow native `fetch`
behaviour and do not call the callback for every redirect hop. For URL-dependent
credentials or signatures, use final endpoint URLs in your configuration and
server session metadata.

## Coordinate authentication with hooks

Authentication runs before `beforeFetch`. For event streams,
`beforeEventSourceConnect` runs after `beforeFetch`. Those hooks can change the
request, including its authentication headers, and a replacement request does
not receive authentication again.

If a signature must include hook changes, sign in the last `beforeFetch` hook,
or the last `beforeEventSourceConnect` hook for a stream. The
[hook guide](../advanced/hooks.md) describes the full request lifecycle and
how callback failures are reported.

## Run in a browser

Serve the application over HTTP or HTTPS. The JMAP server must allow your
application's origin through CORS, including its `Authorization` and
`Content-Type` headers. This applies to the session endpoint and each API,
upload, download, or event-stream origin you use. Your Content Security Policy
must also permit those connections.

With a bundler, install the package and import from `"json-meta-client"` as in
Node.js. For a page without a bundler, use an import map. This page sends a Core
echo request and displays its result; replace the session URL and token before
serving it. The package version comes from this documentation's build.

<script setup>
import { data as pkg } from '../pkg.data.ts'
</script>

```html-vue [index.html]
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>JMAP connection</title>
    <script type="importmap">
      {
        "imports": {
          "json-meta-client": "https://unpkg.com/json-meta-client@{{ pkg.version }}/dist/index.js",
          "eventsource-client": "https://esm.sh/eventsource-client@1.2.0"
        }
      }
    </script>
  </head>
  <body>
    <pre id="output">Connecting…</pre>
    <script type="module">
      import { JsonMetaClient } from "json-meta-client";

      const output = document.querySelector("#output");
      try {
        const client = new JsonMetaClient({
          sessionUrl: "https://jmap.example.com/.well-known/jmap",
          auth: { token: "YOUR_ACCESS_TOKEN" },
          capabilities: [],
        });
        const result = await client.api.Core.echo({ message: "Connected" });
        output.textContent = JSON.stringify(result);
      } catch (error) {
        output.textContent = String(error);
      }
    </script>
  </body>
</html>
```

The entry point is `dist/index.js`. The `eventsource-client` mapping resolves the
dynamic import used by [state-change subscriptions](./events.md); keep it if you
use events. A direct CDN import can replace the package's import-map entry,
but the event-source dependency still needs to resolve.

Browser code can read its own credentials. Supply a token for the current
user's authorised access rather than a shared server secret.

## Update an older configuration

Replace `bearerToken: token` with `auth: { token }`. The old property has no
compatibility alias. If you previously used a dummy bearer token and a request
hook to add Basic credentials, replace that setup with
`auth: { username, password }`.

Event streams now use the same authentication and Fetch hooks as other
requests. Existing hooks therefore need to handle stream requests and preserve
their response bodies. See the [hook migration notes](../advanced/hooks.md#update-older-hook-names).
