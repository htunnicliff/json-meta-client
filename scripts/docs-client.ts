// Provides the `client` that documentation examples use without constructing
// one, matching the client configured in docs/getting-started.md. A page that
// declares its own `client` shadows this one.
import { JsonMetaClient } from "json-meta-client";

const docsClient = new JsonMetaClient({
  auth: { token: "<token>" },
  sessionUrl: "<server>/.well-known/jmap",
  capabilities: ["mail", "submission"],
});

declare global {
  const client: typeof docsClient;
}
