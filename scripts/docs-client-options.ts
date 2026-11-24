/**
 * The options of the client that docs examples use without constructing one,
 * as configured in docs/getting-started.md.
 *
 * Two files build a client from these, and they must agree. `docs-client.ts`
 * declares the ambient `client` that examples are type-checked against, and
 * `docs/.vitepress/plugins/playground-links/playground-code.ts` writes the
 * client that examples open with in the playground. Keeping the options here
 * stops the types and the playground's client drifting apart.
 */
export const docsClientOptions = {
  auth: "<credentials>",
  sessionUrl: "<server>/.well-known/jmap",
  capabilities: ["mail", "submission"],
} as const;
