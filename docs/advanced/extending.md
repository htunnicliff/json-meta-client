# Extending

Use `defineCapability` to declare a capability's URN and entities, then
`withMethods` to supply its method contracts and metadata types. The three type
arguments to `withMethods` are, in order:

1. Entity method contracts, each with `input` and `output` types.
2. Account capability details, exposed in `accounts[id].accountCapabilities`.
3. Session capability details, exposed in `capabilities`.

The last two arguments default to `unknown`. Metadata types do not add properties
to the capability object or validate server responses.

## Extend an existing capability

Declare the same URN as a built-in capability and configure both definitions to
combine their methods and metadata. For example, suppose a server extends the
Mail capability with an `Email/vendorArchive` method and vendor metadata:

```ts
import {
  JsonMetaClient,
  defineCapability,
} from "json-meta-client";
import type {
  ClientSession,
  Config,
} from "json-meta-client";

const vendorMail = defineCapability({
  urn: "urn:ietf:params:jmap:mail",
  entities: ["Email"],
}).withMethods<
  {
    Email: {
      vendorArchive: {
        input: { ids: string[] };
        output: { archived: string[] };
      };
    };
  },
  { mayUseVendorArchive: boolean },
  { vendorVersion: string }
>();

const options: Config<
  readonly ["mail", typeof vendorMail]
> = {
  bearerToken: "<token>",
  sessionUrl: "https://example.test/.well-known/jmap",
  capabilities: ["mail", vendorMail],
};
const client = new JsonMetaClient(options);
const session: ClientSession<typeof options.capabilities> =
  await client.session;

const details = session.capabilities[vendorMail.urn];
if (details) {
  console.log(details.vendorVersion); // string
}

for (const account of Object.values(session.accounts)) {
  const mail = account.accountCapabilities[vendorMail.urn];
  if (mail) {
    console.log(mail.maxMailboxDepth); // number | null (built-in)
    console.log(mail.mayUseVendorArchive); // boolean (vendor)
  }
}

// Both built-in and vendor methods remain available.
await client.api.Email.get({
  ids: ["email-1"],
  properties: ["id", "subject"],
});
await client.api.Email.vendorArchive({ ids: ["email-1"] });
```

For a new capability, use its own URN and configure the resulting object instead.
Definitions sharing a URN are intersected, so declare compatible types for fields
or methods that appear in more than one definition.

When annotating a capability directly, the `Capability` type takes five arguments:
entity names, method contracts, the URN, account details, and session details.
Client configuration and session types, including `Config` and `ClientSession`,
are exported from `json-meta-client`.
