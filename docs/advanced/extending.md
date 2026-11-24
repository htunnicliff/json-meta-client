# Extending

The built-in capabilities cover the JMAP standards, but servers often offer
more: vendor extensions, drafts, or methods of their own. Define a
capability for them, and the client calls them like any built-in method,
with the same batching, default accounts, result references, and types.

## Defining a capability

`defineCapability()` takes the capability's URN and the entities it adds,
and `withMethods()` describes their methods as types:

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
}).withMethods<{
  Note: {
    get: {
      input: { accountId: string; ids: string[] };
      output: {
        state: string;
        list: Note[];
        notFound: string[];
      };
    };
    query: {
      input: {
        accountId: string;
        filter?: { text?: string };
      };
      output: { ids: string[] };
    };
  };
}>();

const notesClient = new JsonMetaClient({
  auth: "<credentials>",
  sessionUrl: "<server>/.well-known/jmap",
  capabilities: ["mail", notes],
});

const groceryNotes = notesClient.api.Note.query({
  filter: { text: "groceries" },
});

const { list: groceryList } =
  await notesClient.api.Note.get({
    ids: groceryNotes.resultRef("/ids"),
  });
```

The pieces fit together like this:

- **`urn`** is the capability's identifier. The client adds it to the
  `using` array of every request that calls one of the capability's
  methods, and uses it to find the default account.
- **`entities`** lists the entity names the capability adds. Each one
  becomes a property of `client.api`, such as `client.api.Note`. Calling
  a method on an entity that no configured capability lists rejects with
  `UnknownEntityError` without sending anything.
- **`withMethods()`** takes up to three type arguments: the methods of each
  entity, then the capability's [account and session
  details](#session-and-account-details). It exists only for the types and
  adds nothing at runtime.

::: tip Declaring the type explicitly
`withMethods()` infers the capability's type. When you need to write that
type out, such as for an exported capability in a project that enables
TypeScript's
[`isolatedDeclarations`](https://www.typescriptlang.org/tsconfig/#isolatedDeclarations),
annotate a plain object with the `Capability` type instead:

```ts
import type { Capability } from "json-meta-client";

interface NoteMethods {
  Note: {
    get: {
      input: { accountId: string; ids: string[] };
      output: { list: Note[] };
    };
  };
}

export const declaredNotes: Capability<
  "Note",
  NoteMethods,
  "urn:example:notes"
> = {
  urn: "urn:example:notes",
  entities: ["Note"],
};
```

Its type arguments are, in order: the entity names, the methods, the URN,
the account details, the session details, and the type of the
[`defaultAccount`](#default-account) setting. The last three are optional;
pass the setting's literal type, such as `{ "Note/copy": null }`, when the
object sets `defaultAccount`. This is how the built-in capabilities are
declared.
:::

Pass the result in the client's `capabilities` option, alongside the names
of any built-in capabilities you use. The client checks the definition when
it is constructed and throws `CapabilityConfigurationError` if it is
malformed. When the session first loads, the client logs a warning if the
server doesn't list the URN.

## Depending on other URNs

Some methods need the server to enable another capability too. List those
URNs in `dependsOn`, and the client adds them to `using` whenever one of the
capability's entities is called:

```ts
const labels = defineCapability({
  urn: "urn:example:labels",
  entities: ["Label"],
  dependsOn: ["urn:ietf:params:jmap:mail"],
}).withMethods<{
  Label: {
    apply: {
      input: {
        accountId: string;
        label: string;
        emailIds: string[];
      };
      output: { updated: string[] };
    };
  };
}>();
```

A `Label/apply` call is then sent with all three URNs:

```json
{
  "using": [
    "urn:ietf:params:jmap:core",
    "urn:example:labels",
    "urn:ietf:params:jmap:mail"
  ]
}
```

The built-in `mdn` capability works this way. `MDN/send` can update the
email it answers, so it depends on the mail URN.

`dependsOn` only changes `using`. It doesn't add the other capability's
entities or types, and the default account still comes from the
capability's own URN. To call `Email` methods as well, configure `"mail"`
too.

## Default account

Most JMAP methods take an `accountId`. When a call leaves it out, the client
fills in the session's primary account for the capability that owns the
method: `session.primaryAccounts[urn]`. If the session lists no primary
account for that URN, the client uses the only account whose
`accountCapabilities` include it. When several accounts do, the call rejects
with `ConfigurationError`; when none does, the client sends the call without
`accountId`, and the server rejects it.

Some methods have no sensible default, such as a copy whose `accountId` is
the destination. The `defaultAccount` setting tells the client which methods
those are:

```ts
interface Task {
  id: string;
  title: string;
}

const tasks = defineCapability({
  urn: "urn:example:tasks",
  entities: ["Task"],
  defaultAccount: { "*": "primary", "Task/copy": null },
}).withMethods<{
  Task: {
    get: {
      input: { accountId: string; ids: string[] };
      output: { list: Task[] };
    };
    copy: {
      input: {
        accountId: string;
        fromAccountId: string;
        ids: string[];
      };
      output: { copied: string[] };
    };
  };
}>();

const client = new JsonMetaClient({
  auth: "<credentials>",
  sessionUrl: "<server>/.well-known/jmap",
  capabilities: [tasks],
});

const { list } = await client.api.Task.get({
  ids: ["task-1"],
});
```

`Task.get` gets the default account for `urn:example:tasks`. `Task.copy`
gets none, so its `accountId` is required at the type level too.

Each key is a method name, `Entity/method`, or `"*"`, and each value is
`"primary"` or `null`:

- A listed method belongs to this capability. `"primary"` gives it the
  capability's default account; `null` gives it no default.
- `"*"` claims every method on the capability's entities that no capability
  lists.
- A setting without `"*"` claims only the methods it lists. A method no
  capability claims gets no default.
- Leaving `defaultAccount` out is the same as `{ "*": "primary" }`.

A key that names an entity or method the capability doesn't declare fails to
compile. Two capabilities can't claim the same method differently: when they
do, the client constructor throws `CapabilityConfigurationError`.

## Method contracts

Each method is described by a `MethodContract`: an object type with an
`input`, the method's arguments, and an `output`, what the call resolves
to.

An output can depend on the arguments of the call. Inside a contract
interface, `this["input"]` is the type of the arguments actually passed.
TypeScript allows `this` only directly in an interface member, so pass it to
a helper type for anything more involved.

::: info Why `this`?
A contract is a type, not a function, so it can't declare type parameters
for each call to fill in. The polymorphic `this` type stands in for them.
When you make a call, the client combines the contract with the call's
argument types, and `this["input"]` then refers to those arguments. Any
type that TypeScript can compute from them, from a simple conditional to
mapped and inferred types, can shape the output. The built-in `get` methods
use this to return only the `properties` a call asks for.
:::

This contract adds snippets to a search's result only when the call asks
for them:

```ts
import type { MethodContract } from "json-meta-client";

interface PageSearch extends MethodContract {
  input: {
    accountId: string;
    text: string;
    withSnippets?: boolean;
  };
  output: this["input"] extends { withSnippets: true }
    ? { ids: string[]; snippets: string[] }
    : { ids: string[] };
}

const notebook = defineCapability({
  urn: "urn:example:notebook",
  entities: ["Page"],
}).withMethods<{
  Page: { search: PageSearch };
}>();

const notebookClient = new JsonMetaClient({
  auth: "<credentials>",
  sessionUrl: "<server>/.well-known/jmap",
  capabilities: [notebook],
});

const { snippets } = await notebookClient.api.Page.search({
  text: "groceries",
  withSnippets: true,
});
```

## How the client adapts contracts

The client doesn't use a contract's `input` exactly as written. Each method
it exposes adjusts the contract in a few ways:

- **`accountId` becomes optional** when the method gets a
  [default account](#default-account), as `Page.search` does above, since
  the client fills it in. A method with no default keeps `accountId`
  required.
- **Top-level arguments accept
  [result references](../features/method-calls.md#result-references)** in
  place of their values, without any change to the contract.
- **Undeclared properties are rejected.** Arguments are checked against
  `input` at any depth, so a misspelled property fails to compile.
- **`this["input"]` is the call's arguments**, with any result references
  resolved to the types they point at and `accountId` included, as
  described [above](#method-contracts).

## Untyped capabilities

Leave out `withMethods()`, and the capability accepts any method name on its
entities:

```ts
const widgets = defineCapability({
  urn: "urn:example:widgets",
  entities: ["Widget"],
});

const widgetClient = new JsonMetaClient({
  auth: "<credentials>",
  sessionUrl: "<server>/.well-known/jmap",
  capabilities: [widgets],
});

const widget = await widgetClient.api.Widget.spin!({
  ids: ["<widgetId>"],
});
```

Every method's result is `unknown`, and its arguments aren't checked. The
methods are typed through an index signature, so the non-null assertion
(`!`) is needed when `noUncheckedIndexedAccess` is on. The client still
batches the calls, adds the URN to `using`, and fills in the default
account. Untyped capabilities are handy for trying out a server's methods;
add contracts once you rely on them.

## Session and account details

The second and third type arguments of `withMethods()` type the details the
server publishes about the capability: the second for each account's
`accountCapabilities[urn]`, the third for the session's
`capabilities[urn]`:

```ts
interface ReminderAccountDetails {
  maxRemindersPerDay: number;
}

interface ReminderSessionDetails {
  supportsRecurrence: boolean;
}

const reminders = defineCapability({
  urn: "urn:example:reminders",
  entities: ["Reminder"],
}).withMethods<
  {
    Reminder: {
      get: {
        input: { accountId: string; ids: string[] };
        output: {};
      };
    };
  },
  ReminderAccountDetails,
  ReminderSessionDetails
>();

const reminderClient = new JsonMetaClient({
  auth: "<credentials>",
  sessionUrl: "<server>/.well-known/jmap",
  capabilities: [reminders],
});

const reminderSession = await reminderClient.session;

const { supportsRecurrence } =
  reminderSession.capabilities["urn:example:reminders"]!;
const { maxRemindersPerDay } =
  reminderSession.accounts["<accountId>"]!
    .accountCapabilities["urn:example:reminders"]!;
```

Both default to `unknown`. Either may be missing from a real session, since
a server or an account may not support the capability, so both are typed
as possibly `undefined`.

## Extending built-in URNs

To add vendor methods or details to a standard capability, define a
capability with the standard URN. Here a vendor adds an `Email/snooze`
method and an account detail under the mail URN:

```ts
const snoozing = defineCapability({
  urn: "urn:ietf:params:jmap:mail",
  entities: ["Email"],
}).withMethods<
  {
    Email: {
      snooze: {
        input: {
          accountId: string;
          ids: string[];
          until: string;
        };
        output: { snoozed: string[] };
      };
    };
  },
  { maySnooze: boolean }
>();

const vendorClient = new JsonMetaClient({
  auth: "<credentials>",
  sessionUrl: "<server>/.well-known/jmap",
  capabilities: ["mail", snoozing],
});

const vendorSession = await vendorClient.session;
const mailDetails =
  vendorSession.accounts["<accountId>"]!
    .accountCapabilities["urn:ietf:params:jmap:mail"]!;

if (mailDetails.maySnooze) {
  void vendorClient.api.Email.snooze({
    ids: ["<emailId>"],
    until: "2026-12-01T09:00:00Z",
  });
}
```

The built-in `Email` methods stay available next to `snooze`. The two
capabilities combine rather than replace each other:

- **Methods are merged per entity.** When both declare the same method,
  the contracts are intersected, so a call must satisfy both inputs and
  resolves to both outputs.
- **Details are merged per URN.** `mailDetails` has the vendor's
  `maySnooze` and the standard `maxMailboxesPerEmail` alike. The same goes
  for session details, such as extending the core capability's limits.

Because both capabilities share a URN, the request's `using` lists it once,
and `snooze` gets the same default account as the standard mail methods.

## Sharing entities across capabilities

Capabilities with different URNs can declare the same entity, such as an
extension that adds methods to another capability's entity. The client
merges them:

- The entity's method types are intersected, as for a shared URN.
- Every call on the entity lists the URN of every capability that declares
  it in `using`, since the client can't tell which one the server needs.

Each method's default account comes from exactly one capability, so the
two can't both claim the entity's methods with `"*"`, which an omitted
`defaultAccount` does. When they do, the client constructor throws
`CapabilityConfigurationError`. Give the capability that adds methods a
`defaultAccount` that lists them:

```ts
const archiving = defineCapability({
  urn: "urn:example:archiving",
  entities: ["Note"],
  defaultAccount: { "Note/archive": "primary" },
}).withMethods<{
  Note: {
    archive: {
      input: { accountId: string; ids: string[] };
      output: { archived: string[] };
    };
  };
}>();

const archiveClient = new JsonMetaClient({
  auth: "<credentials>",
  sessionUrl: "<server>/.well-known/jmap",
  capabilities: [notes, archiving],
});

const { archived } = await archiveClient.api.Note.archive({
  ids: ["<noteId>"],
});
```

`Note/archive` now gets the primary account for `urn:example:archiving`,
while `notes` keeps every other `Note` method through its `"*"`.

## Reusing RFC helper types

The built-in capabilities build their contracts from generic helpers for
the standard method shapes, such as `MethodGet` and `MethodSet`. The
community `maskedEmail` capability uses them too, for its
`MaskedEmail/get` and `MaskedEmail/set`.

These helpers aren't exported from the package yet, so custom capabilities
can't import them. Until they are, write contracts by hand as on this page,
following the argument and response shapes in
[RFC 8620 section 5](https://www.rfc-editor.org/rfc/rfc8620.html#section-5).
