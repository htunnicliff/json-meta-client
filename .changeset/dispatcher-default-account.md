---
"json-meta-client": major
---

**Breaking:** the default `accountId` is now chosen when a batch is sent,
and no longer only from `session.primaryAccounts`.

When a method call doesn't pass `accountId` and the session names no primary
account for the capability that owns the method, the client now looks at the
accounts whose `accountCapabilities` list that capability's URN:

- **One account:** the client uses it. These calls used to be sent without
  `accountId`.
- **No account:** the call is sent without `accountId`, as before.
- **Several accounts:** the call rejects with a `ConfigurationError` that
  names the method and the URN. Only that call is rejected: it is left out of
  the request, and the other calls in the batch still go ahead. If every call
  in a batch is rejected, no request is made. Pass `accountId` to choose an
  account.

The `accountId` is written onto the call's arguments once the session has
loaded, right before the `beforeJmapRequest` hooks run:

- `$args.accountId` is absent until the batch is sent and set afterwards.
  Reading it before the session loaded used to throw "Session not yet
  resolved".
- `beforeJmapRequest` hooks receive `accountId` as a plain value on the
  arguments. It used to be a getter.

A result reference passed as `accountId` is now kept. The client used to add
a default `accountId` beside it.

Method calls in one batch can go to different accounts, such as the primary
mail and primary contacts accounts. A result reference between two such
calls may need an explicit `accountId`.
