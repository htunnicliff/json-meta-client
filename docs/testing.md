# Testing

Test application behaviour against realistic JMAP responses,
then exercise provider-specific behaviour against a real test
account. Unit tests should run without credentials or a server.

## Run a complete mocked request

Install `json-meta-client` using [shared setup](./index.md), save
the following as `testing.ts`, and run `node testing.ts` with Node.js
26 (native TypeScript support). The example replaces `fetch` only
within its own process and restores it in `finally`.

<<< ./snippets/testing.ts

The fixture checks authentication, advertised capabilities,
implicit account selection, invocation IDs, selected properties,
and the serialised result reference. Its response supplies each
pending call's own invocation ID. It verifies two dependent calls
share one batch and that a JMAP method error rejects as `JmapError`.
No real endpoint is contacted: unexpected URLs fail the fixture.

In a test runner, install the mock before constructing the client,
restore it after each test, and avoid running global-fetch mocks
concurrently in the same process. A network interceptor is another
option if it supports your runtime's native `fetch`.

## Choose useful fixtures

Include empty `ids`/`list`, missing IDs in `notFound`, method-level
`error` invocations, HTTP failures and `set` responses with
`notCreated`/`notUpdated`/`notDestroyed`. A successful HTTP request
is not evidence that every write succeeded. Copy the shape of
actual protocol responses, but replace credentials, mail contents,
account IDs and other private data before committing them.

When testing batching, assert the whole request's `using` URNs and
`methodCalls`, then produce a response using the IDs actually sent.
Do not depend on generated random invocation IDs. Check result
reference paths against the selected fields and distinguish
references resolved by the server from values your mock returns.
See [Method Calls](./features/method-calls.md),
[Batching](./advanced/batching.md), and [Errors](./reference/errors.md).

## Manual checks and contributor workflows

The repository uses `pnpm test` for runtime and public type tests,
`pnpm types` for the source, and `pnpm build` for the package. The
[unit fixtures](https://github.com/htunnicliff/json-meta-client/tree/main/src/__test__)
and
[Stalwart integration setup](https://github.com/htunnicliff/json-meta-client/blob/main/src/__test__/integration/setup.ts)
show contributor patterns. `pnpm test:integration` provisions
Stalwart using Testcontainers and needs Docker plus access to its
container image; it is separate from this credential-free mock.

`pnpm docs:check` builds the public package, type-checks every
TypeScript fence in README and the manual as an independent module,
checks included TypeScript files, and runs the exact mocked example
above. Public imports resolve through the built package exports,
not source aliases. `pnpm docs:build` builds VitePress and rejects
broken page links. CI runs both checks.

Shell, JSON, HTML import maps, Deno JavaScript imports, displayed
HTTP payloads and declaration-style signatures outside TypeScript
fences are illustrative, not executable TypeScript inputs. They
still need source/output and rendered-site review. Negative
migration examples use `@ts-expect-error`, so the checker requires
the old configuration to remain rejected. To verify the checker,
temporarily add `const value: string = 123;` to a TypeScript fence;
`pnpm docs:check` must fail with its Markdown source location, then
pass again after you remove it. Keep each fence complete with
imports and setup; do not silently exclude broken examples.
