# Custom capabilities

`defineCapability()` is the public extension API for private capabilities, community specifications, and future JMAP capabilities. Import it from `json-meta-client`; capability authors do not need internal modules.

A definition supplies the capability URN and its entity names. The URN identifies the server capability and is added to each request that calls one of its entities. Entity names are the prefixes of JMAP method names, such as `Note` in `Note/get`. Both URNs and entity names retain literal types when supplied as literals.

Use `.withMethods<Methods>()` to describe each entity's methods. Include every declared entity, using `{}` for an entity with no methods. Each method contract has `input` and `output` fields. These contracts are types only: the client dynamically constructs method calls and does not install handlers or validate server results.

## A complete typed extension

This example declares two entities and a method whose response depends on the requested properties. It uses only public package imports.

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

For argument-dependent results, use an interface and refer to `this["input"]` in its `output` member. Move nested result shapes into a helper type, as above. The client evaluates that output against the supplied arguments after unwrapping result references. Without `properties`, this example returns complete `Note` values. With `properties`, it returns only the selected fields. A plain `{ input: Input; output: Output }` contract is sufficient when the result does not depend on arguments.

Required `accountId` fields become optional on client methods. The current default account middleware uses the session's primary **mail** account. For extensions that use a different account, supply `accountId` explicitly, as in this example. The middleware also injects an account ID into object arguments without an `accountId` key even when the contract does not declare one. Include the appropriate account field in contracts for account-scoped JMAP methods.

Calls return awaitable jobs with IDs suitable for `ref()`. Result references may replace argument values, including nested values. Contracts describe the actual argument and result types, without references or job wrappers. Type declarations describe server behavior; they provide no runtime response validation.

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

The client exposes both `Note/get` and `Note/archive`. Calling any method on `Note` includes both extension URNs in the request's `using` list because definitions contain entity metadata, not per-method runtime metadata. URNs are deduplicated in registration order. Every configured capability is checked against the session, including multiple providers of a shared entity. Core is always included.

Duplicate method names use **intersected contracts**, with no first-provider or last-provider override. Identical contracts are supported. All input and output constraints of overlapping contracts must hold simultaneously. Incompatible contracts are unsupported: an input property declared as both `string` and `number` cannot accept either ordinary value; incompatible output properties can become `never`, even when the input remains callable. The client does not detect these conflicts at runtime. Capability authors must ensure duplicate methods describe the same server operation compatibly. Use distinct entity or method names for different operations.

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

An untyped capability restricts the entity names visible in TypeScript, allows arbitrary string method names and object argument shapes, and returns `unknown`. The non-null assertion is needed with `noUncheckedIndexedAccess` because arbitrary method names are represented by an index signature. Validate or narrow the result before using it. When an untyped capability shares an entity with a typed capability, known methods retain their typed contracts and additional methods return `unknown`. Runtime proxies do not enforce the declared entity or method names; the server determines whether a method exists. `then`, `catch`, and `finally` are reserved by the method proxy and cannot be JMAP method names.

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

`Augment` and `AugmentMethod` are exported compatibility types for the generated client call signatures. Extension authors should declare contracts with `MethodContract` instead of constructing augmented call signatures. Types reached through `src/internal` are implementation details and are not package entry points.
