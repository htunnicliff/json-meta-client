/**
 * The options of the client that docs examples use without constructing one,
 * as configured in docs/getting-started.md.
 *
 * Two files build a client from these, and they must agree. `docs-client.ts`
 * declares the ambient `client` that examples are type-checked against, and
 * `docs/.vitepress/run-example.ts` creates the client that examples run with
 * during the docs build, replacing `<server>` with a placeholder origin.
 * Keeping the options here stops the types and the runtime client drifting
 * apart.
 */
export const docsClientOptions = {
  auth: "<token>",
  sessionUrl: "<server>/.well-known/jmap",
  capabilities: ["mail", "submission"],
} as const;
