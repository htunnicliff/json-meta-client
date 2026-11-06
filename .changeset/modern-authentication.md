---
"json-meta-client": minor
---

BREAKING: Replace `bearerToken` with the required `auth` option.
Migrate `bearerToken: token` to `auth: { token }`; the old option
has no compatibility alias. Basic credentials are supported via
`auth: { username, password }`, with UTF-8/Base64 encoding handled
by the client. Custom callbacks use
`auth: ({ request }) => void | Promise<void>` and can mutate the
outgoing request before it is sent.

Authentication runs before `beforeFetch` hooks on every
transport, including session discovery, API calls, blob transfers,
and event-stream reconnects. Event streams now also run the
request and response hooks; callbacks are awaited for each
connection so callers can supply current credentials.
