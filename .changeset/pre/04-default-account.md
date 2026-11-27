---
"json-meta-client": major
---

**Breaking:** the default `accountId` now depends on the method. In 0.14,
every call without an `accountId` used the primary mail account. Now the
client picks the account when it sends the batch:

1. The primary account of the capability that owns the method, from
   `session.primaryAccounts`. A `ContactCard/get` call, for example, goes to
   the primary contacts account.
2. Otherwise, the only account whose `accountCapabilities` list that
   capability.
3. Otherwise, if no account lists it, the call is sent without `accountId`.

If several accounts list the capability and none is primary, the call
rejects with a `ConfigurationError`. The rest of the batch is still sent.
Pass `accountId` to choose an account.

Other changes:

- `Core/echo` and `PushSubscription` calls are not scoped to an account and
  no longer get an `accountId`.
- `$args.accountId` is absent until the batch is sent. `beforeJmapRequest`
  hooks see it on each call's arguments.
- One batch can now go to several accounts. A result reference between
  calls to different accounts may need an explicit `accountId`.

Custom capabilities can choose which methods get a default with the new
`defaultAccount` setting. A method set to `null` gets no default, and its
`accountId` is required:

```ts
const tasks = defineCapability({
  urn: "urn:example:tasks",
  entities: ["Task"],
  defaultAccount: { "*": "primary", "Task/copy": null },
});
```

The client constructor throws `CapabilityConfigurationError` when two
capabilities claim the same method with different settings.
