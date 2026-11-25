# Contributing

Thanks for helping improve json-meta-client. Bug reports, feature requests,
and pull requests are all welcome. To report a security issue, follow the
[security policy](./SECURITY.md) instead of opening an issue.

## Before you start

For anything beyond a small fix, open an issue first so we can agree on the
approach. The library's types are part of its API, so changes to them get
the same care as runtime changes.

## Setup

You need the Node.js version in [`.node-version`](./.node-version) and the
pnpm version in the `packageManager` field of [`package.json`](./package.json).
If you use [mise](https://mise.jdx.dev/), `mise install` sets up both.

```sh
pnpm install
```

The integration tests run against [Stalwart](https://stalw.art/) in a
container, so they also need Docker or another Docker-compatible runtime.

## Checks

CI runs these on every pull request
([`.github/workflows/ci.yaml`](./.github/workflows/ci.yaml)):

| Command                 | What it checks                                         |
| ----------------------- | ------------------------------------------------------ |
| `pnpm lint`             | oxlint, with fixes applied                             |
| `pnpm spelling:check`   | spelling, with cspell                                  |
| `pnpm fmt:check`        | formatting, with oxfmt (`pnpm fmt` fixes it)           |
| `pnpm test`             | unit tests and type tests                              |
| `pnpm build`            | the package build, with attw and publint               |
| `pnpm package:check`    | that the packed package installs and type-checks       |
| `pnpm docs:check`       | that code examples in the docs type-check              |
| `pnpm docs:build`       | the documentation site                                 |
| `pnpm test:integration` | method calls against a real server (needs a container) |

Git hooks run lint, spelling, and formatting before each commit, and the
build and unit tests before each push.

Which checks matter depends on the change:

- **Library code and types:** run the unit tests and the build. For changes
  to types, add type tests (`*.test-d.ts`) for both accepted and rejected
  usages.
- **Server interactions:** also run the integration tests.
- **Documentation:** run `pnpm docs:check` and `pnpm docs:build`. Code
  examples follow the conventions in [`AGENTS.md`](./AGENTS.md#documentation-examples).

## Changesets

Releases are managed with [Changesets](https://github.com/changesets/changesets).
Add a changeset to any pull request that changes the published package: its
behavior, public types, exports, dependencies, or built output.

```sh
pnpm changeset
```

Describe the change as someone using the library sees it, and choose the
bump that fits. Call out breaking changes explicitly. Documentation, tests,
internal refactors, and tooling changes don't need a changeset.

## Pull requests

- Keep each pull request to one change.
- Explain what changed and why, and link the issue it resolves.
- Make sure the checks above pass.
