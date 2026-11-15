# Extending

## Defining a capability

:::warning TODO
- `defineCapability({ urn, entities }).withMethods<Methods, AccountCaps?, SessionCaps?>()`,
  then pass the object in `capabilities`
:::

## Depending on other URNs

:::warning TODO
- `defineCapability({ urn, entities, dependsOn })` lists other URNs that the
  server needs in `using` for this capability's methods
- The client adds them whenever one of the capability's entities is called
- Built-in example: `mdn` depends on the mail URN because `MDN/send` updates Emails
:::

## Default account

Most JMAP methods take an `accountId`. When a call leaves it out, the client
fills in the session's primary account for the capability that owns the
method: `session.primaryAccounts[urn]`. If the session lists no primary
account for that URN, the client sends the call without `accountId`, and the
server rejects that call.

Some methods have no sensible default, such as a copy whose `accountId` is
the destination. The `defaultAccount` setting tells the client which methods
those are:

```ts
import {
  defineCapability,
  JsonMetaClient,
} from "json-meta-client";

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
  auth: "<token>",
  sessionUrl: "<server>/.well-known/jmap",
  capabilities: [tasks],
});

const { list } = await client.api.Task.get({
  ids: ["task-1"],
});
```

`Task.get` gets the primary account for `urn:example:tasks`. `Task.copy`
gets none, so its `accountId` is required at the type level too.

Each key is a method name, `Entity/method`, or `"*"`, and each value is
`"primary"` or `null`:

- A listed method belongs to this capability. `"primary"` gives it the
  primary account; `null` gives it no default.
- `"*"` claims every method on the capability's entities that no capability
  lists.
- A setting without `"*"` claims only the methods it lists. A method no
  capability claims gets no default.
- Leaving `defaultAccount` out is the same as `{ "*": "primary" }`.

A key that names an entity or method the capability doesn't declare fails to
compile. Two capabilities can't claim the same method differently: when they
do, the client constructor throws `CapabilityConfigurationError`.

## Method contracts

:::warning TODO
- `MethodContract` is `{ input, output }`
- Output can depend on input via `this["input"]` (show the `properties`-narrowing
  example from `custom-capabilities.test-d.ts`)
- A contract with `accountId` makes it optional at the call site
:::

## Untyped capabilities

:::warning TODO
- Omitting `withMethods` types allows any method name with `unknown` results
:::

## Session and account details

:::warning TODO
- The second and third generics type `session.capabilities[urn]` and `accountCapabilities[urn]`
:::

## Extending built-in URNs

:::warning TODO
- Define a vendor capability with the same URN (e.g. vendor `Email` methods under the mail URN)
- Contracts are intersected, not replaced
- Session details are merged (e.g. with `core`)
:::

## Sharing entities across capabilities

:::warning TODO
- Method types are intersected; the request includes every URN providing the entity
- Each method's default account comes from one capability: give the capability
  that adds methods to a shared entity a `defaultAccount` that lists them,
  since two capabilities with different URNs can't both claim `"*"`
:::

## Reusing RFC helper types

:::warning TODO
- `MethodGet`, `MethodSet`, etc., as `masked-email.ts` does
- Blocked: RFC types are not exported from the package entry point yet
:::
