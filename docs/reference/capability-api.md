# Capability API

## `defineCapability()`

```ts
import { defineCapability } from "json-meta-client";

const notes = defineCapability({
  urn: "urn:example:notes",
  entities: ["Note"],
});
```

Accepts `{ urn: string; entities: ReadonlyArray<string> }` and preserves their literal types. The returned object exposes `urn`, `entities`, and `.withMethods<Methods>()`. Without method contracts, custom methods accept arbitrary argument keys and return unknown data.

## `withMethods<Methods>()`

Adds a compile-time method map and returns a `Capability`. The map must include each declared entity, with method names mapped to input/output contracts:

```ts
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

No runtime method implementations are supplied: the client sends method names and arguments to the JMAP server.

## `MethodContract`

A contract has `input` and `output` members. To derive the response from the supplied arguments, extend `MethodContract` and use `this["input"]`:

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

type NoteGetOutput<Input> = { list: SelectedNote<Input>[] };

interface NoteGet extends MethodContract {
  input: {
    accountId: string;
    ids: readonly string[];
    properties?: readonly (keyof Note)[];
  };
  output: NoteGetOutput<this["input"]>;
}
```

Use `NoteGet` as the `get` contract in the entity map. The client makes a required `accountId` optional at the call site and allows typed result references in place of argument values.

## `Capability` and Inference

`Capability<Entity, Methods, Urn>` describes the definition’s entity names, method contracts, and identifier. `InferMethodsFromCapability<typeof notes>` extracts its method map. See [Types](./types.md).

## Registration and Limits

Pass a definition in the constructor’s `capabilities` array:

```ts
const client = new JsonMetaClient({
  bearerToken: "<bearer-token>",
  sessionUrl: "https://your-provider.example/.well-known/jmap",
  capabilities: [notes],
});

const result = await client.api.Note.get({
  accountId: "<notes-account-id>",
  ids: ["<note-id>"],
});
```

Definitions describe server behavior. They do not validate responses or implement capabilities on the server. Shared entities combine method types by intersection; keep overlapping declarations compatible. See [Capabilities](../features/capabilities.md).
