// The options of the client configured in docs/getting-started.md, which
// documentation examples use without constructing one. The docs build runs
// examples with them, replacing `<server>` with a placeholder server.
export const docsClientOptions = {
  auth: "<token>",
  sessionUrl: "<server>/.well-known/jmap",
  capabilities: ["mail", "submission"],
} as const;
