# Testing

:::note TODO
These docs haven't been written yet but will be added soon.
:::

## Mocking the network

:::note TODO
- The client calls global `fetch` with a `Request`; stub it (`vi.stubGlobal`)
  or use an interceptor such as nock or MSW
- Minimal fake-session fixture: `apiUrl`, `uploadUrl` / `downloadUrl` templates,
  `eventSourceUrl`, `primaryAccounts` (including the mail URN),
  `capabilities["urn:ietf:params:jmap:core"]`
:::

## Predictable call IDs

:::note TODO
- Use `{ id }` and `$id` / `$method` to build mocked `methodResponses`
:::

## Inspecting requests

:::note TODO
- Capture outgoing JSON with a `beforeFetch` or `beforeJmapRequest` hook and
  compare to an inline snapshot (pattern from `find-inbox.test.ts`)
:::

## Simulating errors

:::note TODO
- Return `["error", { type }, id]` or an HTTP error status; assert with the `is*Error` guards
:::

## Testing against a real server

:::note TODO
- Summary of the Stalwart + Testcontainers setup, as an option for consumers
:::

## Type tests

:::note TODO
- Optional: `expectTypeOf` to lock down custom capability contracts
:::
