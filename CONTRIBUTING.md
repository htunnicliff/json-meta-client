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
- Make sure CI passes.
