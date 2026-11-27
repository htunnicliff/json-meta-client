---
"json-meta-client": minor
---

Add two client options:

- `generateMethodCallId` returns the ID for each method call, given its
  method name. It applies to isolated batches too. An explicit `id` on a
  call takes precedence.
- `onWarning` receives the configured capabilities that the server doesn't
  advertise, as a `ConfigurationError`, when the session first loads. It
  defaults to `console.warn`, as in 0.14.

The client no longer warns about a capability that the server lists only in
an account's `accountCapabilities`, as Stalwart does for
`urn:stalwart:jmap`.
