# Executable examples

These examples import the built package through its public entry
points. From a repository checkout:

```sh
pnpm install
pnpm build
pnpm examples:check
```

`examples:check` checks every TypeScript example without making
network requests. CI runs it after building the package.
The examples use a modern Node.js runtime with native TypeScript
syntax stripping and the APIs described in
[getting started](../docs/getting-started.md).

Provide your service's session URL and a bearer token, then run:

```sh
JMAP_SESSION_URL=https://your-service/.well-known/jmap JMAP_BEARER_TOKEN=your-token node examples/mail.ts
```

- [mail.ts](mail.ts) finds an inbox, queries mail, requests selected
  properties, uses result references including a wildcard, batches
  independent calls, enables submission, calls the default core echo
  method, and handles errors.
- [blobs-and-events.ts](blobs-and-events.ts) uploads and downloads a
  blob and subscribes to state changes. Press Ctrl+C to disconnect.
- [browser-and-middleware.ts](browser-and-middleware.ts) exports a
  browser-friendly function using a supplied account and middleware;
  import it through your application's bundler.

The examples print returned metadata or content for demonstration.
Use a test account and adapt the output handling for your app.
Running an example requires a server advertising the capabilities
configured in [client.ts](client.ts).
