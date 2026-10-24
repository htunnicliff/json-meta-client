# Capabilities

Configure the capabilities your application uses with built-in names or custom
capability objects. Core is always included.

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  bearerToken: "<token>",
  sessionUrl: "https://example.test/.well-known/jmap",
  capabilities: ["mail", "contacts"],
});
```

## Session and account details

`client.session` and `client.refreshSession()` return capability details keyed by
their URN literals. The built-in types include Core server limits, Mail account
limits, and Contacts account permissions.

Configuring a capability does not guarantee that the server supports it. The
client logs a warning if a configured capability is missing from the session.
Individual accounts may support different capabilities: a shared address book
may support Contacts without supporting Mail. Check for presence before accessing
details.

```ts
const session = await client.session;
const core =
  session.capabilities["urn:ietf:params:jmap:core"];
if (core) {
  console.log(core.maxCallsInRequest); // number
}

for (const account of Object.values(session.accounts)) {
  const mail =
    account.accountCapabilities[
      "urn:ietf:params:jmap:mail"
    ];
  if (mail) {
    console.log(mail.maxMailboxDepth); // number | null
    console.log(mail.mayCreateTopLevelMailbox); // boolean
  }
}
```

Details for capabilities outside the client configuration remain `unknown`. These types describe the
expected response; the client does not validate metadata fields at runtime.

See [Extending](../advanced/extending.md) to add custom metadata or methods.
