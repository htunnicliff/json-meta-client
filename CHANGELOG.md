# json-meta-client

## 1.0.0-alpha.1

### Major Changes

- [#183](https://github.com/htunnicliff/json-meta-client/pull/183) [`f778665`](https://github.com/htunnicliff/json-meta-client/commit/f7786651174de5e74e03f437dd7aea759fb8da34) Thanks [@htunnicliff](https://github.com/htunnicliff)! - BREAKING: Calling a method on an entity that no capability declares, such
  as `client.api.Foo.bar({})`, now rejects with `UnknownEntityError` and is never sent to the server. Previously the call
  was sent without a capability URN in `using`. The error names the entity
  and method; fix it by adding a capability that declares the entity, using a
  built-in capability or `defineCapability`. `Core`, `Blob` and
  `PushSubscription` stay callable without listing `core`. Callers that
  relied on a `beforeJmapRequest` hook to add the URN for an undeclared
  entity must declare the entity with `defineCapability` instead.

- [#188](https://github.com/htunnicliff/json-meta-client/pull/188) [`88ca1cd`](https://github.com/htunnicliff/json-meta-client/commit/88ca1cd840e8d4d3622a1dd7416531edb90509b0) Thanks [@htunnicliff](https://github.com/htunnicliff)! - BREAKING: Remove the unstable `middleware` client option. Passing
  `middleware` to `JsonMetaClient` is now a type error and the option is
  ignored at runtime. The built-in argument transformations (result reference
  keys and `accountId` injection) still run. To change outgoing method calls,
  use a `beforeJmapRequest` hook, which receives the whole request envelope
  including each call's arguments.

## 1.0.0-alpha.0

### Major Changes

- [#170](https://github.com/htunnicliff/json-meta-client/pull/170) [`4787e7a`](https://github.com/htunnicliff/json-meta-client/commit/4787e7aed9d7613a4522c40c50edd54e12647a06) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Release 1.0.0. From this version on, breaking changes bump the
  major version, following semantic versioning.

### Minor Changes

- [#165](https://github.com/htunnicliff/json-meta-client/pull/165) [`b949115`](https://github.com/htunnicliff/json-meta-client/commit/b94911528ea56c5669f494f781cd050cc1ec3055) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Add `beforeFetch` / `afterFetch`, `beforeJmapRequest` / `afterJmapResponse`, and `beforeEventSourceConnect` / `afterEventSourceConnect` hooks with sequential async support. Fetch hooks cover every transport; JMAP hooks transform complete batch envelopes; connection hooks run for each event-stream connection or reconnect before messages are read.

  Breaking: remove the `beforeRequest` / `afterResponse` options and the `BeforeRequestHook` / `AfterResponseHook` type exports. The Fetch hook interface is now `beforeFetch` / `afterFetch` with `BeforeFetchHook` / `AfterFetchHook` types.

  Event streams now validate status, content type, and body availability before connection observers run. Connection failures are reported through the state-change handler as `StateChangeError`; intentional aborts remain silent and HTTP 204 still stops reconnects.

- [#150](https://github.com/htunnicliff/json-meta-client/pull/150) [`1741692`](https://github.com/htunnicliff/json-meta-client/commit/1741692b60e4e0b870d9b791f96e4f4077b9e1de) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Use the built-in RFC types for all client and capability contracts.

  Blob, Contacts, and Sieve methods now validate arguments and infer responses. Core exposes the RFC `echo` method. Session metadata and mail inputs now follow the built-in RFC contracts, including required core limits, nullable email address fields, and required mailbox IDs when creating emails.

- [#163](https://github.com/htunnicliff/json-meta-client/pull/163) [`a4cb17a`](https://github.com/htunnicliff/json-meta-client/commit/a4cb17a69a5153864c0eaa42a79f830a180c8ddb) Thanks [@htunnicliff](https://github.com/htunnicliff)! - BREAKING: Replace `bearerToken` with the required `auth` option.
  Migrate `bearerToken: token` to `auth: token`; the old option
  has no compatibility alias. Basic credentials are supported via
  `auth: { username, password }`, with UTF-8/Base64 encoding handled
  by the client. Custom callbacks use
  `auth: ({ request }) => void | Promise<void>` and can mutate the
  outgoing request before it is sent.

  Authentication runs before `beforeFetch` hooks on every
  transport, including session discovery, API calls, blob transfers,
  and event-stream reconnects. Event streams now also run the
  request and response hooks; callbacks are awaited for each
  connection so callers can supply current credentials.

- [`833234c`](https://github.com/htunnicliff/json-meta-client/commit/833234cf727a862497c0fa4b3e5094d9dc96d7c2) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Remove sourcemaps

## 0.14.0

### Minor Changes

- [#135](https://github.com/htunnicliff/json-meta-client/pull/135) [`df1e572`](https://github.com/htunnicliff/json-meta-client/commit/df1e572a242d2fe8ae609effdd7f11e2ca030ade) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Relicense from MIT to MPL-2.0

### Patch Changes

- [#135](https://github.com/htunnicliff/json-meta-client/pull/135) [`df1e572`](https://github.com/htunnicliff/json-meta-client/commit/df1e572a242d2fe8ae609effdd7f11e2ca030ade) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Add description, keywords, funding, and homepage to package.json

## 0.13.0

### Minor Changes

- [#115](https://github.com/htunnicliff/json-meta-client/pull/115) [`714890e`](https://github.com/htunnicliff/json-meta-client/commit/714890ee3dc2bdb0c073d894b1eee34351442c67) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Add typed session and account details for configured capabilities.

- [`d97c547`](https://github.com/htunnicliff/json-meta-client/commit/d97c547de69620298c5afa5e598721c4328ee944) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Add `isolated()` for dedicated batches

- [`aa54389`](https://github.com/htunnicliff/json-meta-client/commit/aa543890efc3a75fda3809f13c76d9f49738cd2c) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Rename `ref()` to `resultRef()`

### Patch Changes

- [`4dccd8d`](https://github.com/htunnicliff/json-meta-client/commit/4dccd8d2840f16ff31d9cde8dfb527ede70c9d90) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Extract built-ins and related types

- [`e03d324`](https://github.com/htunnicliff/json-meta-client/commit/e03d324ee26e93a5d06e4fd3674ff347dd393e58) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Add comments to library internals

- [`1fc25e1`](https://github.com/htunnicliff/json-meta-client/commit/1fc25e1e4f1b71d693ec0d9f808dbc21ef579633) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Use a short string of random hexadecimal characters instead of full UUIDs for method call IDs

- [#114](https://github.com/htunnicliff/json-meta-client/pull/114) [`02b9699`](https://github.com/htunnicliff/json-meta-client/commit/02b96993d9a1ad75508f3ef08102d526dbbbbdea) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Add typed `createdRef()` creation ID references to pending `/set` results

- [`4dccd8d`](https://github.com/htunnicliff/json-meta-client/commit/4dccd8d2840f16ff31d9cde8dfb527ede70c9d90) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Extract static validation from class

## 0.12.0

### Minor Changes

- [`abd2718`](https://github.com/htunnicliff/json-meta-client/commit/abd271818e1ab99f4589c430a3e0f5e48ae502d7) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Add cancelBatch method for clearing a pending batch

- [`190262d`](https://github.com/htunnicliff/json-meta-client/commit/190262dcffac49ba8d9ba4ae3c9cf111f623106a) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Add support for custom IDs in method calls

### Patch Changes

- [`18f9521`](https://github.com/htunnicliff/json-meta-client/commit/18f95219c88fc898533194b18ed39205f6193850) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Make ref $props readonly

## 0.11.0

### Minor Changes

- [`b754720`](https://github.com/htunnicliff/json-meta-client/commit/b754720f67c54bd29ab32755f184417b6df88461) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Add beforeRequest and afterResponse hooks

- [`30568dc`](https://github.com/htunnicliff/json-meta-client/commit/30568dc315578e61241b9dd7282a2ab226dd2556) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Rename `Client` to `JsonMetaClient`

## 0.10.0

### Minor Changes

- [`619dd67`](https://github.com/htunnicliff/json-meta-client/commit/619dd67717d63e128549ac2b446f0b1adb970e39) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Accept built-in capability export names alongside configured capability objects in client options, preserving inferred API method types.

- [`5215085`](https://github.com/htunnicliff/json-meta-client/commit/52150859f9342cdcd7ca2108b5e22cc54e3fe583) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Enable isolatedDeclarations

- [`a3c1421`](https://github.com/htunnicliff/json-meta-client/commit/a3c142120c56d51ba0cb18e70c5a2146c6c7873e) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Move ref API into method call results

- [`8438af3`](https://github.com/htunnicliff/json-meta-client/commit/8438af3f72fcf0243c3f4c6cd88bf9bce7603055) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Add definitive error kinds, including separate HTTP and protocol errors with
  request and response context. Retain the associated method call on JMAP errors
  and validate server response envelopes before processing them.

  Preserve upload body media types instead of forcing JSON request headers.

- [`5215085`](https://github.com/htunnicliff/json-meta-client/commit/52150859f9342cdcd7ca2108b5e22cc54e3fe583) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Stabilize public API

## 0.9.0

### Minor Changes

- [`21262fd`](https://github.com/htunnicliff/json-meta-client/commit/21262fd4b94751b30f7c913ece470d3211a1a303) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Support multiple capabilities augmenting the same entity.

- [`b094589`](https://github.com/htunnicliff/json-meta-client/commit/b0945897639728b29304e955d28f9a4b34f19a13) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Simplify method contract inference boundaries

### Patch Changes

- [`ce377ba`](https://github.com/htunnicliff/json-meta-client/commit/ce377baaabeba76e1cbaba56162d5c57ce99cbb2) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Reject pending method calls when batch processing throws or rejects, and document and test the automatic batching boundaries and failure behavior.

## 0.8.0

### Minor Changes

- [`5a13bb1`](https://github.com/htunnicliff/json-meta-client/commit/5a13bb14dfb81c73fa06218cff3ab299fbaee01f) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Added community capabilities with masked email

- [`df55e6f`](https://github.com/htunnicliff/json-meta-client/commit/df55e6fd5dcd353ccaf64568df4e72c356226950) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Use camel case for capability definitions

## 0.7.1

### Patch Changes

- Upgraded pnpm and type-fest

## 0.7.0

### Minor Changes

- [`563d24b`](https://github.com/htunnicliff/json-meta-client/commit/563d24b21c195135d2f9b19651e53b3de8e9b5d4) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Added partially-typed sieve capability

- [`4ca6611`](https://github.com/htunnicliff/json-meta-client/commit/4ca6611d841ede1b2782e343c39a3124d78714f2) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Required explicit client capabilities and added a dedicated subpath export (`/capabilities`).

  Made `core` an always-included export.

- [`2917c85`](https://github.com/htunnicliff/json-meta-client/commit/2917c858042cd8e9b8a6078e436ac16d3ee278cb) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Added partially typed blob expansion capability

- [`fff6382`](https://github.com/htunnicliff/json-meta-client/commit/fff6382c497ce8548769834960807072019f2e76) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Add configurable logger

- [`4bb0cf4`](https://github.com/htunnicliff/json-meta-client/commit/4bb0cf4194758bb32116cd1fd57e160d6f2c43b6) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Added runtime options validation

### Patch Changes

- [`bc1cded`](https://github.com/htunnicliff/json-meta-client/commit/bc1cded4464bb0e402814198518a2b42f3d08e0d) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Log warning when capabilities are used but not actually available in a given session

## 0.6.1

### Patch Changes

- [`06ada60`](https://github.com/htunnicliff/json-meta-client/commit/06ada602f2d35f016b3731d075f0f6c500583fda) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Simplify README formatting

## 0.6.0

### Minor Changes

- [`64e2884`](https://github.com/htunnicliff/json-meta-client/commit/64e28841e439104f32c9eb93ed549d2bb862a893) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Added any-typed contacts capability

## 0.5.0

### Minor Changes

- [`28cce18`](https://github.com/htunnicliff/json-meta-client/commit/28cce18bbf95063a66190870256be4dff63a06be) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Added onStateChange event source handling

- [`28a0d27`](https://github.com/htunnicliff/json-meta-client/commit/28a0d2791cc8b305990dd0d9b27d910014978535) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Added API for blob uploads and downloads

## 0.4.0

### Minor Changes

- [#8](https://github.com/htunnicliff/json-meta-client/pull/8) [`8b52bea`](https://github.com/htunnicliff/json-meta-client/commit/8b52beaaceec33cdac834049e40c0fd13d76cb8b) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Adopt improved contract types and fix broken `{Entity}/get` properties filtering.

## 0.3.3

### Patch Changes

- [#6](https://github.com/htunnicliff/json-meta-client/pull/6) [`83792b0`](https://github.com/htunnicliff/json-meta-client/commit/83792b012b9969236e0a4d532bcd2bbec2f0d932) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Mark the package as side-effect free so bundlers can safely tree-shake unused exports.

## 0.3.2

### Patch Changes

- [`2d1dfa0`](https://github.com/htunnicliff/json-meta-client/commit/2d1dfa06794eac0f270a696192ce9dee94138597) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Add license to npm files

## 0.3.1

### Patch Changes

- [`c355ef1`](https://github.com/htunnicliff/json-meta-client/commit/c355ef10ce18cfb32118df4853a1d15fa73a6726) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Add MIT license

- [`67b9b6c`](https://github.com/htunnicliff/json-meta-client/commit/67b9b6c56c96adc69a8ec12b8af12880be24e822) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Improve package.json and bundle settings

## 0.3.0

### Minor Changes

- [`420352f`](https://github.com/htunnicliff/json-meta-client/commit/420352fcae0ac35a9d342a3cb85334749b3ad933) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Significantly flesh out functionality

## 0.2.0

### Minor Changes

- 7b326f8: Ignore test files in publish

## 0.1.1

### Patch Changes

- ff84cca: Update exports
