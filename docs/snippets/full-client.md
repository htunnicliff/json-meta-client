```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://example.net/.well-known/jmap",
  auth: "801e9603323bc4ab5c87686f31fea5a45f7793038bfc9f17",
  capabilities: [
    "mail",
    "submission",
    // and more...
  ],
  hooks: {
    beforeFetch: [],
    beforeJmapRequest: [],
    beforeEventSourceConnect: [],
    // and more...
  },
});
```
