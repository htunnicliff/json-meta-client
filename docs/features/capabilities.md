<!-- cspell:words vacationresponse -->

# Capabilities

Capabilities describe the extensions a JMAP server understands. A client definition associates a capability identifier with entity names and TypeScript method contracts.

## Select the extensions you use

```ts
const client = new JsonMetaClient({
  sessionUrl: "https://your-provider.example/.well-known/jmap",
  bearerToken: "<bearer-token>",
  capabilities: ["mail", "submission"],
});
```

This selection exposes mail and submission methods to TypeScript. For each request, the client includes the core identifier and the configured identifiers associated with the entities being called in JMAP's `using` array.

Core method types are always available, even with `capabilities: []`. You do not have to add `core` explicitly.

## Built-in definitions

| Name in configuration   | Capability identifier                      | Entities                                      |
| ----------------------- | ------------------------------------------ | --------------------------------------------- |
| `core`                  | `urn:ietf:params:jmap:core`                | `Core`, `Blob`, `PushSubscription`            |
| `mail`                  | `urn:ietf:params:jmap:mail`                | `Mailbox`, `Thread`, `Email`, `SearchSnippet` |
| `submission`            | `urn:ietf:params:jmap:submission`          | `Identity`, `EmailSubmission`                 |
| `vacationResponse`      | `urn:ietf:params:jmap:vacationresponse`    | `VacationResponse`                            |
| `blob`                  | `urn:ietf:params:jmap:blob`                | `Blob`                                        |
| `contacts`              | `urn:ietf:params:jmap:contacts`            | `AddressBook`, `ContactCard`                  |
| `sieve`                 | `urn:ietf:params:jmap:sieve`               | `SieveScript`                                 |
| `community:maskedEmail` | `https://www.fastmail.com/dev/maskedemail` | `MaskedEmail`                                 |

The `blob`, `contacts`, and `sieve` definitions still use `any` for some inputs or records. Their type checking is less complete than that of the mail definitions.

The `blob` capability adds JMAP methods on `client.api.Blob`. Uploading and downloading raw bytes through `client.blob` are separate [HTTP operations](./blobs.md).

## Check server and account support

Configuration supplies types; it cannot add an extension to a server. Check your provider's documentation or inspect `session.capabilities` after `await client.session`.

On the first successful session load, the client warns about configured entity capabilities missing from the session. It still permits calls. The server may reject a method or capability it does not support.

Account support also matters. Choose an account that supports the extension and pass its `accountId`. The client's automatic account selection always uses the primary mail account.

## Describe a custom extension

Use `defineCapability()` to retain literal entity names and attach your server's method contracts:

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

Register it alongside built-ins with `capabilities: ["mail", notes]`. This example assumes a hypothetical notes extension; replace its identifier, methods, and types with your server's actual contract.

Without `.withMethods<...>()`, the definition allows arbitrary method names and argument keys, with unknown response data. The [capability reference](../reference/capability-api.md) explains typed and argument-dependent contracts.

## Share an entity across extensions

Multiple capabilities can contribute methods to the same entity. Their contracts combine by TypeScript intersection, and calls on that entity include all its configured identifiers in `using`.

Keep overlapping declarations compatible. Conflicting types can collapse to `never`, and the client does not diagnose conflicts or validate responses at runtime.
