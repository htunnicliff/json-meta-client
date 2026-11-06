# Best Practices

Start with [installation and shared setup](./index.md), then use
these choices to keep an application predictable.

## Choose capabilities and accounts deliberately

Configure only the capabilities you use; core is automatic.
Configuration gives TypeScript knowledge and controls outgoing
`using` URNs, while session and account metadata describe server
support. Check both. Explicitly pass `accountId` for shared and
non-mail accounts: the implicit default is the primary mail
account. See [Capabilities](./features/capabilities.md).

## Group work at the right boundary

Create independent calls before awaiting them, then use
`Promise.all`. Sequential awaits mean separate requests. Use
`resultRef()` or `createdRef()` for server-side dependencies within
one request rather than inventing IDs or reading pending results.
Use `isolated()` for work with a separate cancellation/queue scope.
The client does not split work to satisfy server limits: chunk
large workloads yourself. See [Method Calls](./features/method-calls.md)
and [Batching](./advanced/batching.md).

## Fetch only the data you consume

Select properties explicitly and include every field the code
reads. Use a stable sort and bounded pages, and stop on an empty
page. Account for records moving or disappearing between pages.
Keep an ID distinct from the object fetched with that ID. See the
[pagination recipe](./index.md#read-the-inbox-in-pages).

## Handle both kinds of failure

Catch request/method failures at the application's operation
boundary, preserve `cause` and structured diagnostics, and show a
message appropriate to the user. Also inspect `notCreated`,
`notUpdated`, and `notDestroyed`: a fulfilled `set` call can contain
per-object failures. A retry of a write can duplicate work when the
first response was lost, so reconcile server state before retrying
non-idempotent actions. See [Errors](./reference/errors.md) and the
[mail recipes](./examples.md).

## Own subscription and credential lifetimes

Close state subscriptions on route/component teardown or worker
shutdown. Notifications invalidate local data; they do not update
your cache automatically. Resume from a stored data-type state or
fetch a fresh snapshot after an interruption. See
[Events](./features/events.md).

Obtain credentials through the application's authentication flow,
not committed source. A browser token is visible to its user and
must be limited to that user's authorised access; never ship a
shared server secret in frontend bundles. Use HTTPS and configure
CORS for each session/API/transfer/event origin. Server applications
can supply rotating credentials through `auth` callbacks. Avoid
logging authentication headers or private mail bodies. See
[Authentication](./features/authentication.md) and
[Hooks](./advanced/hooks.md).

## Make the integration reproducible

Keep a small mocked HTTP test for success, method failures and
per-object failures, and exercise real server behaviour separately.
Use the [Testing](./testing.md) walkthrough for a runnable fixture;
keep server prerequisites outside unit tests.
