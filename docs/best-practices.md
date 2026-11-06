# Designing an application

A JMAP client sits between your application's view of an account and the
server's current data. json-meta-client handles requests, response types, and
batching. Your application still decides which account to use, what to cache,
and how to recover when an operation has an uncertain outcome.

Those decisions are easier to make when each application operation has a clear
boundary: load one screen, move one message, or submit one draft.

## Make the account part of the operation

A user can have several accounts, and those accounts can support different
features. A shared address book, for example, need not support mail. Passing
`accountId` into application operations keeps that choice visible and prevents
a method from using the wrong account by default.

The client's implicit default is always the primary mail account. It does not
choose an account based on the method's capability. Configuration supplies
TypeScript contracts, while the session describes what the server and its
accounts support. Both matter: a method can be available in your editor and
still be unsupported by the selected account. The
[capability guide](./features/capabilities.md) shows how to check support.

## Let dependencies determine request boundaries

Independent reads can share a request. Create them together, then await them
with `Promise.all`. If one call needs IDs from another, a result reference lets
the server resolve that dependency within the same request.

A shared request is not a transaction. One method can succeed while another
fails, and `Promise.all` does not cancel its siblings when it rejects. When
operations need separate queues or cancellation scopes, use `isolated()`.
The [batching guide](./advanced/batching.md) covers these boundaries and the
server limits you must respect when dividing larger workloads.

## Treat a cache as a view that can become stale

Fetch the fields a view needs, with a bounded page size and an explicit sort.
Even then, records can move or disappear between a query and a get, or between
pages. An ID in a query result does not guarantee that its object remains
readable. Check `notFound`, and decide how the view should respond to missing
objects.

State notifications tell you that data changed; they do not update your cache.
Use the state from your last successful read or changes response to reconcile
it, and fetch a fresh snapshot when the server can no longer calculate
changes. After a disconnection, reconcile rather than assuming that every
notification arrived. See [events and synchronisation](./features/events.md).

## Distinguish rejection from an incomplete write

An awaited method can reject because the request failed or the server rejected
the method. A fulfilled `set` can still contain per-object failures in
`notCreated`, `notUpdated`, or `notDestroyed`. Check those maps before reporting
success to the user.

A lost response creates a different problem: the server may have completed
the write even though your application saw a connection error. Retrying a
non-idempotent operation, such as creating a submission, can duplicate it.
Retain enough context to inspect server state before retrying. The
[error reference](./reference/errors.md) describes the failure shapes, and the
[sending example](./examples.md#send-an-email) shows the checks around a draft
and its submission.

## Give credentials and subscriptions an owner

Obtain credentials through your application's authentication flow. A browser
token is accessible to the person using that browser, so it should represent
that user's access. Keep shared server secrets out of frontend bundles and
avoid recording authentication headers or private message bodies in logs.
Server applications can use an [authentication callback](./features/authentication.md#use-current-credentials-for-each-request)
to supply current credentials.

An event subscription also needs an owner: a screen, component, worker, or
service. Close it when that owner stops using it, including during error
recovery. Batch cancellation does not close event streams. The
[event guide](./features/events.md#subscribe-and-release-the-connection) shows
how to tie a subscription to an abort signal and dispose it explicitly.

## Test the decisions your application makes

Mocked HTTP responses let you test empty results, partial writes, and recovery
without a live account. Keep provider-specific checks in a separate suite
against a test server. This makes the routine tests reproducible while still
checking the assumptions that depend on your provider. Start with the
[mocked-request walkthrough](./testing.md).
