# Add a server extension

Use `defineCapability()` when your server implements a JMAP extension that the
client does not provide as a built-in. A descriptor names the capability URI
and its entities. Adding method contracts gives those entities typed arguments
and results, while the client handles the usual request batching and references.

The descriptor does not install an extension on the server or implement its
methods. You need the server's protocol definition to describe them accurately.

## Define a typed capability

Suppose a server advertises `urn:example:notes` and defines `Note/get`. This
example describes that method, along with server-wide and per-account metadata:

```ts
import {
  defineCapability,
  JsonMetaClient,
} from "json-meta-client";

interface Note {
  id: string;
  title: string;
  body: string;
}

const notes = defineCapability({
  urn: "urn:example:notes",
  entities: ["Note"],
}).withMethods<
  {
    Note: {
      get: {
        input: {
          accountId: string;
          ids: readonly string[];
        };
        output: { list: readonly Note[] };
      };
    };
  },
  { maxNotes: number },
  { version: string }
>();

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: [notes],
});

const session = await client.session;
const accountId = session.primaryAccounts[notes.urn];
const account = accountId
  ? session.accounts[accountId]
  : undefined;
const accountDetails =
  account?.accountCapabilities[notes.urn];
const serverDetails = session.capabilities[notes.urn];
if (!accountId || !accountDetails || !serverDetails) {
  throw new Error(
    "A notes server and account are required",
  );
}
console.log(serverDetails.version, accountDetails.maxNotes);

const result = await client.api.Note.get({
  accountId,
  ids: ["NOTE_ID"],
});
for (const note of result.list) console.log(note.title);
```

The three `.withMethods()` type arguments describe methods, account metadata,
and session metadata, in that order. Both metadata types default to `unknown`.
The builder accepts no runtime method implementations; it preserves the literal
URI and entity names in a descriptor containing `urn` and `entities`.

Check advertised support before reading metadata. A declared metadata type does
not guarantee the server returned it. Pass `accountId` explicitly for extension
methods: omitting it uses the primary mail account, even for a notes method.

Built-in keys can appear alongside descriptors in `capabilities`. Use those keys
rather than importing internal built-in descriptors or RFC modules; the public
package does not expose those module paths.

## Make a result type depend on the arguments

Some methods return different fields depending on their input. Extend
`MethodContract` and refer to `this["input"]` in the output to model that
relationship. For a notes protocol with a `properties` selection, the contract
could be:

```ts
import type { MethodContract } from "json-meta-client";

interface Note {
  id: string;
  title: string;
  body: string;
}

type SelectedNote<Input> = Pick<
  Note,
  Input extends {
    properties: readonly (infer Key extends keyof Note)[];
  }
    ? Key
    : keyof Note
>;

type NoteGetOutput<Input> = {
  list: readonly SelectedNote<Input>[];
};

interface NoteGet extends MethodContract {
  input: {
    accountId: string;
    ids: readonly string[];
    properties?: readonly (keyof Note)[];
  };
  output: NoteGetOutput<this["input"]>;
}
```

Use `NoteGet` in place of the `get` contract in the descriptor above. A call
selecting `properties: ["id", "title"] as const` then exposes just those fields
on each result. The client also evaluates contracts against the value types
carried by [result references](../features/method-calls.md#reference-a-previous-result).
This describes the protocol to TypeScript; it does not validate returned JSON.

## Combine contributions to an entity

Descriptors can add different methods to the same entity, including under the
same capability URI. For example, a second notes descriptor could add
`Note/archive` while the first provides `Note/get`. Contributions sharing a URI
also combine their declared metadata types.

The client combines contracts through intersections. Keep overlapping method
and metadata definitions compatible; conflicting property types can become
`never`, and the runtime does not choose a winning definition. When different
URIs contribute to one entity, every configured URI for that entity enters the
request's `using` array. See [capability composition](../features/capabilities.md#understand-which-uris-a-request-uses).

## Call a method before you have a contract

A descriptor without `.withMethods()` permits arbitrary method names on its
entities and returns `unknown`. Narrow or validate the result before using it:

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

const result = await client.api.Vendor.inspect!({
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

The non-null assertion accommodates indexed method lookup with
`noUncheckedIndexedAccess`; it does not check whether the server supports
`Vendor/inspect`. An untyped descriptor can share an entity with a typed one:
known methods retain their contracts and other methods return `unknown`.

The client validates descriptor configuration, adds capability requirements,
serialises arguments, and matches responses by invocation ID. Permissions,
limits, response schemas, and the accuracy of your contracts still depend on
the protocol and server. The [authoring type reference](../reference/types.md#capability-authoring)
lists the supported public types.
