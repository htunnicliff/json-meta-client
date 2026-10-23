<!-- cspell:words vacationresponse -->

# Capabilities

A capability describes a JMAP extension: its identifier, the entities it provides, and their method types. Configure the capabilities you plan to use so TypeScript can offer the corresponding `client.api` methods.

```ts
const client = new JsonMetaClient({
  bearerToken: "<bearer-token>",
  sessionUrl: "https://your-provider.example/.well-known/jmap",
  capabilities: ["mail", "submission"],
});
```

For each batch, the client adds the core URN and the configured URNs associated with the called entities to the request’s `using` array. Choosing a capability does not add support for it to the server.

## Built-in Capabilities

| Configuration name      | Identifier                                 | Entities                                      |
| ----------------------- | ------------------------------------------ | --------------------------------------------- |
| `core`                  | `urn:ietf:params:jmap:core`                | `Core`, `Blob`, `PushSubscription`            |
| `mail`                  | `urn:ietf:params:jmap:mail`                | `Mailbox`, `Thread`, `Email`, `SearchSnippet` |
| `submission`            | `urn:ietf:params:jmap:submission`          | `Identity`, `EmailSubmission`                 |
| `vacationResponse`      | `urn:ietf:params:jmap:vacationresponse`    | `VacationResponse`                            |
| `blob`                  | `urn:ietf:params:jmap:blob`                | `Blob`                                        |
| `contacts`              | `urn:ietf:params:jmap:contacts`            | `AddressBook`, `ContactCard`                  |
| `sieve`                 | `urn:ietf:params:jmap:sieve`               | `SieveScript`                                 |
| `community:maskedEmail` | `https://www.fastmail.com/dev/maskedemail` | `MaskedEmail`                                 |

Core method types are always included in the client API, and every request includes the core URN. You do not need to list `core` yourself.

The `blob`, `contacts`, and `sieve` definitions are not fully typed: some records or method arguments use `any`. The `blob` extension is separate from the [HTTP blob helpers](./blobs.md).

## Choosing Capabilities

Check your provider’s documentation or inspect `await client.session`. On the first successful session load, the client warns if a configured entity’s capability is absent from `session.capabilities`. This warning does not prevent requests or remove methods from the API.

An empty `capabilities` array is allowed; core method types remain available. For non-mail capabilities, pass an account ID that supports the capability. See [Method Calls](./method-calls.md).

## Custom Capabilities

Use `defineCapability()` for a server extension:

```ts
import { defineCapability } from "json-meta-client";

const notes = defineCapability({
  urn: "urn:example:notes",
  entities: ["Note"],
}).withMethods<{
  Note: {
    get: {
      input: { accountId: string; ids: string[] };
      output: { list: { id: string; title: string }[] };
    };
  };
}>();
```

Pass the definition alongside built-in names in `capabilities: ["mail", notes]`. The identifier and methods must match a real extension supported by your server. The example identifier illustrates the API only.

Without `.withMethods<...>()`, a definition permits arbitrary methods with unknown output types. See [Capability API](../reference/capability-api.md) for more on authoring contracts.

## Combining Capabilities

Capabilities can share an entity. Their method contracts are combined as TypeScript intersections, and calls on that entity include all its mapped capability identifiers in `using`.

Keep shared method declarations compatible. The client does not detect conflicting contracts; incompatible declarations can produce unusable types such as `never`. Definitions provide type information, not runtime validation.
