# Executable examples

These examples demonstrate the client through its public package imports.
Build the package and check the examples from a repository checkout:

```sh
pnpm install
pnpm build
pnpm examples:check
```

`examples:check` type-checks every example without contacting a server.
CI runs it after the build. To execute an example, use a Node runtime
with native TypeScript syntax stripping and the APIs listed in
[getting started](../docs/getting-started.md).

## Run an example

Provide your service's session URL and bearer token:

```sh
JMAP_SESSION_URL=https://your-service/.well-known/jmap JMAP_BEARER_TOKEN=your-token node examples/mail.ts
```

- [mail.ts](mail.ts) finds an inbox and fetches mail using selected
  properties and result references. It also shows wildcard references,
  independent batched calls, submission, `Core.echo`, and error handling.
- [blobs-and-events.ts](blobs-and-events.ts) uploads and downloads a
  blob and subscribes to state changes. Press Ctrl+C to disconnect.
- [browser-and-middleware.ts](browser-and-middleware.ts) exports a
  browser-friendly function using a supplied account and middleware;
  import it through your application's bundler.

Use a test account: the examples print returned metadata or content.
Adapt that output handling for your application. Your server must advertise
the capabilities configured in [client.ts](client.ts).
