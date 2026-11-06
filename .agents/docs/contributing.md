# Contributing

## Tools and checks

Use pnpm. Read `package.json` for scripts and the package manager version,
`.node-version` for Node, and `.github/workflows/ci.yaml` for CI checks.
Use those files as the source of truth for commands and versions.

Choose validation by the affected behavior:

- Library code and types: run the unit suite and build. For type contract
  changes, cover both accepted and rejected usages in the relevant type tests.
- Server interactions: also run the integration suite. Its setup in
  `src/__test__/integration/setup.ts` provisions Stalwart through Testcontainers;
  a working Docker-compatible runtime and access to the container image are
  required.
- VitePress content or configuration: run the docs build.
- Tooling or CI: run the affected commands or checks.
- Markdown-only agent guidance: check formatting, spelling, and local links.

Run the applicable CI lint, spelling, and formatting checks before handing
off code changes. Inspect scripts before running them: lint and formatting
commands can modify files. Review resulting changes.

Report which checks passed and which could not run, with the reason for
each missing check. A missing integration prerequisite leaves that suite
unverified.

## Changesets

Include a changeset for changes to the published package's behavior, public
types, exports, dependencies, or distributed artifacts. Describe the effect
on consumers and choose the version bump appropriate to the current release
line; call out breaking changes explicitly.

Documentation-only changes, tests, internal refactors with no consumer effect,
and development tooling changes do not need a changeset unless they also
affect the published package.

Use `.changeset/config.json` and existing entries for package naming and
format. Add a new entry for the change; versioning and publishing are handled
by `.github/workflows/release.yaml`.
