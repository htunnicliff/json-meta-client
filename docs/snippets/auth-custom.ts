import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  capabilities: ["mail", "submission"],
  sessionUrl: "<url>",
  auth: async ({ request }) => {
    request.headers.set("X-Custom", "<custom-value>");
  },
});
