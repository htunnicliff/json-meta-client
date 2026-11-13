// Provides the `client` that documentation examples use without constructing
// one, matching the client configured in docs/getting-started.md. A page that
// declares its own `client` shadows this one.
import { JsonMetaClient } from "json-meta-client";

import { docsClientOptions } from "./docs-client-options.ts";

const docsClient = new JsonMetaClient(docsClientOptions);

declare global {
  const client: typeof docsClient;
}
