<!-- cspell:words behaviour -->

# Capabilities

A JMAP capability identifies a set of protocol features with a URI, often a URN such as `urn:ietf:params:jmap:mail`. Entities name the objects or services those features operate on; methods combine an entity and operation, such as `Email/get`. The [catalogue](/reference/capabilities) lists the exact configuration keys, capability URIs, entities, and typed methods.

## Select capabilities

The client always includes JMAP Core: `Core/echo`, `Blob/copy`, and `PushSubscription/get` and `/set`. Select every other capability explicitly using its exact key. Community keys include the `community:` prefix.

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail", "submission", "vacationResponse"],
});

console.log(
  await client.api.Core.echo({ message: "Connected" }),
);
```

`capabilities: []` is valid and retains Core. Configuring `submission` does not configure `mail`; select both to use both APIs. Custom descriptors created with [`defineCapability`](/advanced/extending) can appear alongside string keys.

Three distinct things determine whether an operation can succeed:

| Layer                             | Meaning                                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Contracts and metadata types      | Describe arguments, inferred results, and capability details at compile time. They do not inspect server responses. |
| Client configuration              | Supplies typed methods and maps each entity to the capability URIs included in requests.                            |
| Session and account advertisement | Describes the features the server and each account actually support. Configuration does not enable server features. |

The constructor rejects unknown built-in keys and malformed descriptors with a [`CapabilityConfigurationError`](/reference/errors#configuration-errors). On the first successful session load, configured capability URIs absent from `session.capabilities` produce a `console.warn(ConfigurationError)`. This warning does not reject the session or prevent requests. Later refreshes do not repeat this validation. Account support and method arguments are not validated against the server's advertised capabilities or limits.

## Check support and choose an account

[JMAP sessions](https://www.rfc-editor.org/rfc/rfc8620.html#section-2) contain server-wide `capabilities`, per-account `accountCapabilities`, and `primaryAccounts`, a mapping from capability URI to its primary account ID. A shared account can support contacts without supporting mail. Check presence before accessing typed metadata; configured details remain optional in [`ClientSession`](/reference/types#client-types).

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["contacts"],
});

const urn = "urn:ietf:params:jmap:contacts";
const session = await client.session;
if (!session.capabilities[urn])
  throw new Error("Server does not advertise contacts");

const accountId = session.primaryAccounts[urn];
const account = accountId
  ? session.accounts[accountId]
  : undefined;
const details = account?.accountCapabilities[urn];
if (!accountId || !details)
  throw new Error(
    "No primary contacts account is available",
  );

console.log(
  "May create an address book:",
  details.mayCreateAddressBook,
);
const result = await client.api.AddressBook.get({
  accountId,
  ids: null,
});
console.log(result.list); // An empty list is valid.
```

For a shared account, choose an ID from `session.accounts` and check its `accountCapabilities` instead of relying on `primaryAccounts`. Check `isReadOnly` and operation-specific permissions before writes; the server still decides whether a request is permitted.

When method arguments omit `accountId`, the client injects **the primary mail account ID**, regardless of the called entity. Blob HTTP helpers use the same default. It does not find the primary account for the method's capability. Pass `accountId` explicitly for contacts, Sieve, custom capabilities, shared accounts, or any deployment without a primary mail account.

## Composition and request requirements

Multiple descriptors can contribute methods to one entity, including descriptors with the same URI. Their TypeScript contracts are intersected; declarations must be compatible. No provider is selected and conflicting contracts are not diagnosed at runtime.

For each request, `using` contains Core plus every configured capability URI associated with any called entity, with duplicates removed. Selection is by entity, rather than by method. For example, configuring `blob` makes a call to `Blob/copy` include both Core and the Blob capability because both describe `Blob`. An extension contributing to `Email` makes every Email call include its URI. Configure only the extensions the server supports: an unsupported URI can cause the server to reject the request with `unknownCapability` under [RFC 8620 §3.6](https://www.rfc-editor.org/rfc/rfc8620.html#section-3.6).

See [Extending](/advanced/extending) for custom contracts and [Method Calls](/features/method-calls) for request and reference behaviour.
