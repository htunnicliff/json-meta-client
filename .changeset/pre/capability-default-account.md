---
"json-meta-client": major
---

**Breaking:** the default `accountId` now comes from the primary account of
the capability that owns the method, `session.primaryAccounts[urn]`, instead
of always the primary mail account. A `ContactCard/get` call, for example,
now uses the primary contacts account. Servers must list each capability's
URN in `primaryAccounts`; when one is missing, the client sends that
capability's calls without `accountId`, so pass it explicitly. `Core/echo`
and `PushSubscription` calls are not scoped to an account and no longer get
an `accountId` added.

Custom capabilities can choose which methods get a default with the new
`defaultAccount` setting:

```ts
const tasks = defineCapability({
  urn: "urn:example:tasks",
  entities: ["Task"],
  defaultAccount: { "*": "primary", "Task/copy": null },
});
```

A method set to `null` gets no default, and its `accountId` becomes required
at the type level. Leaving the setting out is the same as
`{ "*": "primary" }`. When two capabilities claim the same method with
different settings, such as two capabilities with different URNs that both
declare an entity without a `defaultAccount`, the client constructor throws
`CapabilityConfigurationError`.
