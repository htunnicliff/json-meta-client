---
"json-meta-client": minor
---

Define explicit supported package exports. Add public types for client options,
pending calls, middleware context, call options, and community entities, along
with structured error classes. Rename `Config` to `ClientOptions` and make
incidental root exports private.

Replace the nonexistent `Core.get` declaration with `Core.echo`, whose result
type follows its arguments. Skip account injection for echo and preserve
explicit account references. Verify the packed package in Node and browser
bundlers, including strict type resolution and preserved error class names.
