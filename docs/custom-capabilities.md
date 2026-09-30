# Custom capabilities

Use `defineCapability()` to add methods for a private or community extension,
or a JMAP capability without a built-in preset. Import it from
`json-meta-client`.

A definition has two parts: a capability identifier in `urn` and a list of
entity names. An entity is the prefix of a method name, such as `Note` in
`Note/get`. Calling one of those entities includes its capability identifier
in the request. Literal identifiers and entity names retain their literal types.

Add `.withMethods<Methods>()` to describe the methods and their argument and
result types. Include every declared entity; use `{}` for one with no methods.
Each method has an `input`/`output` contract. These types guide TypeScript
inference; the client constructs calls dynamically and leaves response
validation to your application.

## A complete typed extension

This example defines `Note` and `Notebook` methods. `Note.get` returns the
fields named in `properties`, so its result type depends on its arguments.

```ts
import { Client, defineCapability, ref, type MethodContract } from "json-meta-client";
import { mail } from "json-meta-client/capabilities";

interface Note {
  id: string;
  title: string;
  body: string;
}

interface NoteGetOutput<Input> {
  list: readonly Pick<
    Note,
    Input extends { properties: readonly (infer Property extends keyof Note)[] }
      ? Property
      : keyof Note
  >[];
}

interface NoteGet extends MethodContract {
  input: {
    accountId: string;
    ids: readonly string[];
    properties?: readonly (keyof Note)[];
  };
  output: NoteGetOutput<this["input"]>;
}

export const notes = defineCapability({
  urn: "urn:example:notes",
  entities: ["Note", "Notebook"],
}).withMethods<{
  Note: {
    get: NoteGet;
    query: {
      input: { accountId: string; text: string };
      output: { ids: string[] };
    };
  };
  Notebook: {
    list: { input: {}; output: { ids: string[] } };
  };
}>();

const client = new Client({
  sessionUrl: "https://example.test/jmap",
  bearerToken: "token",
  capabilities: [mail, notes],
});

const query = client.api.Note.query({ accountId: "notes-account", text: "draft" });
const selected = await client.api.Note.get({
  accountId: "notes-account",
  ids: ref(query, "/ids"),
  properties: ["id", "title"] as const,
});

const titles: readonly Pick<Note, "id" | "title">[] = selected.list;
```

`NoteGet` uses an interface so `output` can refer to `this["input"]`. The
helper `NoteGetOutput` uses the property selection to narrow each note.
Omitting `properties` returns complete notes; supplying it returns the selected
fields. The client evaluates the result type after unwrapping reference value
types. For a fixed result, use `{ input: Input; output: Output }` directly, as
in `query` and `list`.

Declare `accountId` in contracts for account-scoped methods. The client makes
a required account field optional for callers and defaults it to the primary
**mail** account. This extension uses another account, so the calls supply
`accountId` explicitly. Account injection also applies to object arguments
without `accountId` or `#accountId` when the contract has no account field;
`Core.echo` is the exception. See [account selection](getting-started.md#choosing-an-account).

Declare protocol values in your contracts. The client supplies the pending
promise and allows `ref()` in argument values, including nested values, so
contracts need neither promise wrappers nor reference types.

## Sharing entities

Multiple capabilities can contribute methods to the same entity. For example:

```ts
export const archive = defineCapability({
  urn: "urn:example:archive",
  entities: ["Note"],
}).withMethods<{
  Note: {
    archive: {
      input: { accountId: string; ids: readonly string[] };
      output: { archived: string[] };
    };
  };
}>();

const client = new Client({
  sessionUrl: "https://example.test/jmap",
  bearerToken: "token",
  capabilities: [mail, notes, archive],
});

await client.api.Note.archive({ accountId: "notes-account", ids: ["note-1"] });
```

With both presets configured, the client exposes `Note/get` and `Note/archive`.
Any `Note` call includes both extension identifiers in `using`: runtime metadata
associates capabilities with entities rather than individual methods. Identifiers
are deduplicated in registration order, and Core is always included. The session
check covers every configured provider of the shared entity.

If both capabilities declare the same method, TypeScript intersects their
contracts: every input and output constraint must hold. Identical contracts
work. Incompatible ones can make the method unusable or produce `never` result
properties. For example, an input property required to be both `string` and
`number` accepts neither ordinary value.

The client does not detect these conflicts at runtime. Keep duplicate contracts
compatible descriptions of one server operation, and use distinct entity or
method names for different operations.

## Untyped capabilities

Omit `.withMethods()` when the method contracts are unavailable:

```ts
const vendor = defineCapability({
  urn: "urn:example:vendor",
  entities: ["Vendor"],
});

const client = new Client({
  sessionUrl: "https://example.test/jmap",
  bearerToken: "token",
  capabilities: [vendor],
});

const result: unknown = await client.api.Vendor.perform!({ accountId: "vendor-account", value: 1 });
```

TypeScript recognizes `Vendor` but allows any string method name and object
arguments, with an `unknown` result. Validate or narrow that result before use.
The `!` assertion is needed with `noUncheckedIndexedAccess`, since arbitrary
method names use an index signature.

When an untyped capability shares an entity with a typed one, known methods keep
their contracts and additional methods return `unknown`. Runtime proxies leave
entity and method validation to the server. The method names `then`, `catch`,
and `finally` are reserved for promise behavior.

## Public authoring types

| API                                   | Purpose                                                                                  |
| ------------------------------------- | ---------------------------------------------------------------------------------------- |
| `defineCapability()`                  | Capture an entity list and capability URN.                                               |
| `ConfigurableCapability<Entity, Urn>` | Definition before `.withMethods()`, also usable as an untyped capability.                |
| `Capability<Entity, Methods, Urn>`    | Typed capability value; the URN parameter defaults to `string` for existing annotations. |
| `CapabilityMethods<Entity>`           | Entity-to-method contract map constraint.                                                |
| `MethodContract`                      | Contract with `input` and `output`; use it as an interface base if helpful.              |
| `Apply<Contract, Input>`              | Evaluate a contract's output for a particular input type.                                |
| `InferMethodsFromCapability<C>`       | Recover the contract map from a capability.                                              |

Use `MethodContract` to declare extensions and let the client derive call
signatures. `Augment`, `AugmentMethod`, and modules under `src/internal` are
private. See [method contracts](method-contracts.md) for the inference steps.
