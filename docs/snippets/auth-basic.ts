import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  capabilities: ["mail", "submission"],
  sessionUrl: "<url>",
  auth: {
    username: "<username>",
    password: "<password>",
  },
});
