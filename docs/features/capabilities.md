# Choose capabilities and an account

Configure the protocol features your application needs, then choose an account
that supports them. These are separate decisions: adding `"mail"` gives your
client typed mail methods, but it does not enable mail on a server or grant
access to an account.

JMAP names each feature set with a capability URI, such as
`urn:ietf:params:jmap:mail`. json-meta-client provides shorter configuration keys
for built-in capabilities. The [capability catalogue](../reference/capabilities.md)
lists the keys, URIs, and methods.

## Select the methods you need

List each capability explicitly. For mail storage and sending, select both
`"mail"` and `"submission"`:

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail", "submission"],
});
```

Core is always included, even with `capabilities: []`. It supplies `Core.echo`,
`Blob.copy`, and `PushSubscription.get` and `set`. Other capabilities do not
implicitly include each other: selecting `"submission"` alone does not expose
`Email` or `Mailbox` methods. Community keys include their `community:` prefix.

You can also include [custom descriptors](../advanced/extending.md) alongside
built-in keys. Unknown keys and malformed descriptors fail during construction
with `CapabilityConfigurationError`.

## Check support and choose an account

Read the session before relying on a feature. `session.capabilities` describes
server-wide support. Each entry in `session.accounts` has its own
`accountCapabilities`, because accounts can offer different features.
`primaryAccounts` maps a capability URI to its primary account ID.

This example selects the primary contacts account and checks its advertised
permissions before listing address books:

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["contacts"],
});

const session = await client.session;
const contacts = "urn:ietf:params:jmap:contacts";
if (!session.capabilities[contacts]) {
  throw new Error("The server does not advertise contacts");
}

const accountId = session.primaryAccounts[contacts];
const account = accountId
  ? session.accounts[accountId]
  : undefined;
const details = account?.accountCapabilities[contacts];
if (!accountId || !details) {
  throw new Error(
    "No primary contacts account is available",
  );
}

console.log(
  "May create an address book:",
  details.mayCreateAddressBook,
);
const result = await client.api.AddressBook.get({
  accountId,
  ids: null,
});
console.log(result.list);
```

For a shared or secondary account, choose its ID from `session.accounts` and
check that entry instead of using `primaryAccounts`. Before writing, also check
`isReadOnly` and the permissions relevant to the operation. The server remains
the authority on whether a request is allowed.

When you omit a method's `accountId`, the client uses the primary **mail**
account, regardless of the method. Blob HTTP helpers use the same default.
Pass the account explicitly for contacts, Sieve, custom capabilities, and shared
accounts. For a workflow that combines capabilities, such as creating and
submitting an email, choose one account that supports both.

## Read capability details safely

Configured capabilities give the session's metadata TypeScript types. Their
presence is still optional: the server or account may not advertise them. Check
for a capability before reading its limits or permissions, as the example does
with `details`.

The first successful session load warns about configured capabilities absent
from the server. That warning does not reject the session or block later calls,
and subsequent refreshes do not repeat it. The client does not validate response
schemas, account permissions, or arguments against advertised limits. A typed
call still needs a suitable account and a supporting server.

## Understand which URIs a request uses

A JMAP request has a `using` array declaring the capabilities it requires. The
client includes Core, then adds every configured URI associated with an entity
called in that request. Selection is by entity, rather than by individual
method, and duplicate URIs are removed.

For example, Core supplies `Blob.copy`. If you also configure `"blob"`, a call
to `Blob.copy` includes both Core and the Blob capability because both contribute
to `Blob`. An extension of `Email` likewise adds its URI to every Email call.
Configure extensions supported by your server; an unsupported required URI can
cause an `unknownCapability` request error.

Several descriptors can contribute to the same entity or share a URI. Their
method and metadata contracts combine through TypeScript intersections, so
those contracts must be compatible. The client does not choose between
conflicting definitions at runtime. The [extension guide](../advanced/extending.md)
shows how to author and combine descriptors.
