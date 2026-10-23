# Capability API

Custom capability definitions connect your server's entity names to TypeScript method contracts. They contain metadata and types; method implementations remain on the server.

## `defineCapability()`

`defineCapability({ urn, entities })`

- `urn`: the capability's string identifier.
- `entities`: a readonly array of entity names.

The helper preserves literal types and returns an object with `urn`, `entities`, and `withMethods<Methods>()`.

```ts
import { defineCapability } from "json-meta-client";

const notes = defineCapability({
  urn: "urn:example:notes",
  entities: ["Note"],
});
```

A definition without method contracts allows arbitrary method names and argument keys, returning unknown data. The identifier above is illustrative; use the exact identifier your server advertises.

## `withMethods<Methods>()`

Attach an entity-to-method map. Include every declared entity, then give each method an `input` and an `output` type:

```ts
const notes = defineCapability({
  urn: "urn:example:notes",
  entities: ["Note"],
}).withMethods<{
  Note: {
    get: {
      input: { accountId: string; ids: readonly string[] };
      output: { list: { id: string; title: string }[] };
    };
  };
}>();
```

This returns a `Capability` value. Passing it to the constructor exposes `client.api.Note.get` with the supplied contract:

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://your-provider.example/.well-known/jmap",
  bearerToken: "<bearer-token>",
  capabilities: [notes],
});

const result = await client.api.Note.get({
  accountId: "<notes-account-id>",
  ids: ["<note-id>"],
});
console.log(result.list);
```

The client makes a required `accountId` optional at the call site and allows result references in argument positions. Supply the account explicitly when the primary mail account is not appropriate.

## `MethodContract`

`MethodContract` has `input` and `output` members. Extend it when the output depends on the arguments. Using `this["input"]` lets the client apply the actual call's input type to your output calculation:

```ts
import type { MethodContract } from "json-meta-client";

interface Note {
  id: string;
  title: string;
}

type SelectedNote<Input> = Pick<
  Note,
  Input extends { properties: readonly (infer Key extends keyof Note)[] } ? Key : keyof Note
>;

type NoteList<Input> = { list: SelectedNote<Input>[] };

interface NoteGet extends MethodContract {
  input: {
    accountId: string;
    ids: readonly string[];
    properties?: readonly (keyof Note)[];
  };
  output: NoteList<this["input"]>;
}
```

Use `NoteGet` in place of the fixed `get` contract above. A call selecting `properties: ["title"]` then describes a list of records with the selected field. Keep your type calculation consistent with the server's real behavior, including any fields it always returns.

## `Capability` and `InferMethodsFromCapability`

`Capability<Entity, Methods, Urn>` describes the entity names, method map, and identifier. `InferMethodsFromCapability<typeof notes>` extracts the method map from a definition.

Both are exported types. See [Types](./types.md) for imports and inference guidance.

## Contract boundaries

Definitions do not validate server responses, implement methods, or check extension compatibility. Multiple definitions for an entity combine their method types by intersection. Conflicting declarations can produce unusable types, so keep shared contracts compatible.

Register the definitions you need in `capabilities`; use [HTTP hooks](../features/hooks.md) for request customization rather than adding runtime behavior to a capability definition.
