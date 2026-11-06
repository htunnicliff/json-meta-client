<!-- cspell:words serialises -->

# Extending

Use `defineCapability` to expose a server extension through the same batching, account injection, and reference helpers as built-in methods. The server must implement the extension; defining it only supplies client metadata and TypeScript contracts. See [Capabilities](/features/capabilities) for support checks and request requirements.

## Define typed methods

This example assumes a server advertising `urn:example:notes` and an account supporting that capability. Its example protocol defines `Note/get` with an argument-dependent property selection. `MethodContract` uses `this["input"]` to evaluate the output against the actual call's arguments.

```ts
import {
  defineCapability,
  JsonMetaClient,
  type MethodContract,
} from "json-meta-client";

interface Note {
  id: string;
  title: string;
  body: string;
}

type NoteSelection<Input> = Pick<
  Note,
  Input extends {
    properties: readonly (infer Key extends keyof Note)[];
  }
    ? Key
    : keyof Note
>;

type NoteGetOutput<Input> = {
  list: readonly NoteSelection<Input>[];
};

interface NoteGet extends MethodContract {
  input: {
    accountId: string;
    ids: readonly string[];
    properties?: readonly (keyof Note)[];
  };
  output: NoteGetOutput<this["input"]>;
}

const notes = defineCapability({
  urn: "urn:example:notes",
  entities: ["Note"],
}).withMethods<
  { Note: { get: NoteGet } },
  { maxNotes: number }, // Per-account capability details.
  { version: string } // Server-wide capability details.
>();

const archive = defineCapability({
  urn: "urn:example:notes",
  entities: ["Note"],
}).withMethods<{
  Note: {
    archive: {
      input: { accountId: string; ids: readonly string[] };
      output: { archived: string[] };
    };
  };
}>();

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail", notes, archive],
});

const session = await client.session;
const accountId = session.primaryAccounts[notes.urn];
const account = accountId
  ? session.accounts[accountId]
  : undefined;
const accountDetails =
  account?.accountCapabilities[notes.urn];
const sessionDetails = session.capabilities[notes.urn];
if (!accountId || !accountDetails || !sessionDetails) {
  throw new Error(
    "A notes account and server capability are required",
  );
}
console.log(
  accountDetails.maxNotes,
  sessionDetails.version,
);

const result = await client.api.Note.get({
  accountId,
  ids: ["NOTE_ID"],
  properties: ["id", "title"] as const,
});
for (const note of result.list)
  console.log(note.id, note.title);
// The selected result has no `body` property in its type.
```

`defineCapability` preserves literal entity and URI types. `.withMethods<Methods, AccountDetails, SessionDetails>()` accepts no runtime arguments and returns a descriptor containing `urn` and `entities`. The two metadata parameters default to `unknown`. Omit them when the protocol defines no details; their presence in a type does not establish server support.

Descriptors can contribute different methods to the same entity, as `notes` and `archive` do above. Contributions sharing a URI also combine their declared metadata. For different URIs, every URI associated with a called entity enters `using`. Keep overlapping method contracts compatible: intersections of conflicting property types can become `never`, and there is no runtime conflict resolver.

Contracts with an `accountId` input permit its omission at the call site. The default is always the primary **mail** account, so extension calls should normally pass it explicitly. Argument-dependent outputs also work with typed result references; the client evaluates the contract against the value type carried by a reference. [Method Calls](/features/method-calls) covers references and selected built-in properties.

## Call an untyped extension

A descriptor without `.withMethods()` permits arbitrary method names on its declared entities and returns `unknown`. Validate or narrow the returned value before using it.

```ts
import {
  defineCapability,
  JsonMetaClient,
} from "json-meta-client";

const vendor = defineCapability({
  urn: "urn:example:vendor",
  entities: ["Vendor"],
});
const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: [vendor],
});

// Requires a server implementing this method and an account supporting it.
const result: unknown = await client.api.Vendor.inspect!({
  accountId: "ACCOUNT_ID",
});
if (
  typeof result === "object" &&
  result !== null &&
  "status" in result
) {
  console.log(result.status);
}
```

The non-null assertion accommodates indexed method lookup with `noUncheckedIndexedAccess`; it does not check server support. An untyped descriptor may share an entity with typed descriptors: known contracts retain their types and unknown methods retain `unknown` results.

## Runtime boundary

The client validates descriptor shape during construction, adds URI requirements, serialises arguments, and routes method responses by invocation ID. It does not generate method implementations, install a server extension, validate response schemas, enforce declared permissions or limits, or validate the argument-dependent selection against returned JSON. JavaScript callers and type assertions can bypass contracts. A wrong contract can therefore compile and still produce a server error or an unexpected result.

The supported authoring exports are [`defineCapability`, `Capability`, `MethodContract`, and `InferMethodsFromCapability`](/reference/types#capability-authoring). Built-in descriptors and internal RFC modules have no public package subpath; use built-in string keys alongside your descriptors.
