import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: "<token>",
  capabilities: ["mail", "blob"],
});

void client.api.Blob.upload({
  create: {
    note: {
      data: [{ "data:asText": "Hello, world" }],
      type: "text/plain",
    },
  },
});

const [contents, usedBy] = await Promise.all([
  client.api.Blob.get({
    // The blob that `Blob/upload` creates as "note"
    ids: ["#note"],
    properties: ["data:asText", "digest:sha", "size"],
  }),
  client.api.Blob.lookup({
    typeNames: ["Email"],
    ids: ["<blobId>"],
  }),
]);
