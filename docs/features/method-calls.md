# Method Calls

## Calling methods

:::warning TODO
- Pattern `client.api.<Entity>.<method>(args, options?)` maps to JMAP `"Entity/method"`
- Arguments and responses are typed by the configured capabilities
- At runtime the API is a Proxy, but only entities declared by a configured capability (or
  `core`) can be called; any other entity rejects with `UnknownEntityError` and is never sent.
  Method names on known entities are not validated
:::

## Account IDs

:::warning TODO
- When `accountId` is omitted, the client fills it in from the capability that
  owns the method (e.g. contacts for `ContactCard` calls), in this order:
  1. `session.primaryAccounts[urn]`, the primary account for that capability
  2. otherwise, the only account whose `accountCapabilities` list that URN
- If no account lists the URN, the call is sent without `accountId`
- If several accounts list it and the session names no primary, only that call
  rejects with `ConfigurationError` (names the method and URN); it is left out
  of the request and the rest of the batch still goes ahead. Pass `accountId`
- Calls in one batch can target different accounts (mail and contacts
  primaries can differ), so a result reference between them may need an
  explicit `accountId` on one side (multi-account example belongs here)
- A call that references a rejected call is still sent; the server answers it
  with `invalidResultReference`
- `Blob.copy` never gets a default; `Core.echo` and `PushSubscription` calls
  aren't scoped to an account and get none
- Custom capabilities choose with `defaultAccount` (link to Extending)
- An explicitly passed `accountId` is always kept, including a result reference
- The account is chosen when the batch is sent, after the session loads:
  `$args.accountId` is absent before that and set afterwards, and
  `beforeJmapRequest` hooks see it
:::

## Getting results

:::warning TODO
- A call returns a promise for the method's response arguments
- The call is sent when its batch flushes, not when awaited (link to Batching)
:::

## Selecting properties

:::warning TODO
- `properties` on `/get` narrows the type of each `list` item; otherwise default
  properties; `id` is always included
- `Email/get` also narrows body parts based on `bodyProperties`
:::

## Result references

:::warning TODO
- `call.resultRef("/pointer")` passes one call's output to another in the same request
- Pointer is type-checked against the source call's output, including the `*`
  array wildcard (RFC 8620 section 3.7); the pointed-to value is checked against the argument type
- Refs can be nested anywhere in arguments; the client rewrites `key` to `#key`
- One call can be referenced more than once
- Show the request JSON next to the example
:::

## Creation references

:::warning TODO
- `createdRef("localId")` exists only on `/set` calls and returns `"#localId"`
- ID is checked against the keys of `create` at the type level and at runtime
  (unknown ID throws `RangeError`)
- The consuming call must be in the same batch
- Reuse the "Draft and send" example
:::

## Patch updates

:::warning TODO
- `update` takes typed `PatchObject` paths such as `"keywords/$seen": true`
- `null` removes a value; arrays are replaced whole
- JSON Pointer escaping (`~0`, `~1`) is handled in the types
:::

## Call metadata

:::warning TODO
- Every pending call has `$id`, `$method`, `$args`
- The `{ id }` option sets the ID for one method call
- Use [`generateMethodCallId`](../reference/api.md#generatemethodcallid) to
  configure how the client generates IDs
:::

## Method errors

:::warning TODO
- When one method in a batch fails, only that call rejects with `JmapError`;
  the others still resolve (short `try`/`catch` example)
- Link to the Errors reference
:::
