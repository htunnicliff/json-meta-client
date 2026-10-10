# json-meta-client

## 0.11.0

### Minor Changes

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
