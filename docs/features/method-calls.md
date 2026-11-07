# Method Calls

:::note TODO
These docs haven't been written yet but will be added soon.
:::

<!-- DOCS OUTLINE (not rendered)
- ## Calling methods
  - Pattern `client.api.<Entity>.<method>(args, options?)` maps to JMAP `"Entity/method"`
  - Arguments and responses are typed by the configured capabilities
  - At runtime the API is a Proxy: any `Entity.method` name can be called; only the types limit it
- ## Account IDs
  - When `accountId` is omitted, it is filled from
    `session.primaryAccounts["urn:ietf:params:jmap:mail"]`
  - Gotcha: this is the primary MAIL account even for Contacts or Sieve calls;
    pass `accountId` explicitly for other accounts (multi-account example belongs here)
  - An explicitly passed `accountId` is always kept
- ## Getting results
  - A call returns a promise for the method's response arguments
  - The call is sent when its batch flushes, not when awaited (link to Batching)
- ## Selecting properties
  - `properties` on `/get` narrows the type of each `list` item; otherwise default
    properties; `id` is always included
  - `Email/get` also narrows body parts based on `bodyProperties`
- ## Result references
  - `call.resultRef("/pointer")` passes one call's output to another in the same request
  - Pointer is type-checked against the source call's output, including the `*`
    array wildcard (RFC 8620 section 3.7); the pointed-to value is checked against the argument type
  - Refs can be nested anywhere in arguments; the client rewrites `key` to `#key`
  - One call can be referenced more than once
  - Show the request JSON next to the example
- ## Creation references
  - `createdRef("localId")` exists only on `/set` calls and returns `"#localId"`
  - ID is checked against the keys of `create` at the type level and at runtime
    (unknown ID throws `RangeError`)
  - The consuming call must be in the same batch
  - Reuse the "Draft and send" example
- ## Patch updates
  - `update` takes typed `PatchObject` paths such as `"keywords/$seen": true`
  - `null` removes a value; arrays are replaced whole
  - JSON Pointer escaping (`~0`, `~1`) is handled in the types
- ## Call metadata
  - Every pending call has `$id`, `$method`, `$args`
  - `{ id }` option sets a custom method-call ID (default `"Entity/method::<8 hex>"`);
    useful for debugging and snapshot tests
- ## Method errors
  - When one method in a batch fails, only that call rejects with `JmapError`;
    the others still resolve (short `try`/`catch` example)
  - Link to the Errors reference
-->
