// #region setup
import assert from "node:assert/strict";

import { JsonMetaClient, JmapError } from "json-meta-client";

const host = "https://jmap.example.com";
const accountId = "ACCOUNT_ID";
const core = "urn:ietf:params:jmap:core";
const mail = "urn:ietf:params:jmap:mail";
const originalFetch = globalThis.fetch;
let batches = 0;
let failNext = false;
// #endregion setup

// #region session
const session = {
  capabilities: {
    [core]: {
      maxSizeUpload: 50_000_000,
      maxConcurrentUpload: 4,
      maxSizeRequest: 1_000_000,
      maxConcurrentRequests: 4,
      maxCallsInRequest: 16,
      maxObjectsInGet: 100,
      maxObjectsInSet: 100,
      collationAlgorithms: ["i;unicode-casemap"],
    },
    [mail]: {},
  },
  accounts: {
    [accountId]: {
      name: "Example account",
      isPersonal: true,
      isReadOnly: false,
      accountCapabilities: { [mail]: {} },
    },
  },
  primaryAccounts: { [mail]: accountId },
  username: "user@example.com",
  apiUrl: `${host}/api`,
  downloadUrl: `${host}/download/{accountId}/{blobId}/{name}?type={type}`,
  uploadUrl: `${host}/upload/{accountId}`,
  eventSourceUrl: `${host}/events?types={types}&closeafter={closeafter}&ping={ping}`,
  state: "SESSION_STATE",
};
// #endregion session

// #region transport
// Run this fixture in isolation; restore fetch before another test runs.
globalThis.fetch = async (input) => {
  assert(input instanceof Request);
  assert.equal(input.headers.get("authorization"), "Bearer TEST_TOKEN");
  if (input.url === `${host}/.well-known/jmap`) {
    return Response.json(session);
  }
  assert.equal(input.url, `${host}/api`);
  assert.equal(input.method, "POST");
  batches++;
  const body: {
    using: string[];
    methodCalls: [string, Record<string, unknown>, string][];
  } = await input.json();
  assert(body.using.includes(core));
  assert(body.using.includes(mail));
  const query = body.methodCalls[0];
  assert(query);
  assert.equal(query[0], "Email/query");
  assert.equal(query[1].accountId, accountId);
  if (failNext) {
    return Response.json({
      methodResponses: body.methodCalls.map(([method, , id]) => [
        "error",
        {
          type: method === "Email/query" ? "invalidArguments" : "invalidResultReference",
          description: "Fixture failure",
        },
        id,
      ]),
      sessionState: "SESSION_STATE",
    });
  }
  const get = body.methodCalls[1];
  assert(get);
  assert.equal(get[0], "Email/get");
  assert.deepEqual(get[1]["#ids"], { resultOf: query[2], name: "Email/query", path: "/ids" });
  assert.deepEqual(get[1].properties, ["id", "subject"]);
  return Response.json({
    methodResponses: [
      [
        "Email/query",
        {
          accountId,
          queryState: "QUERY_STATE",
          canCalculateChanges: false,
          position: 0,
          ids: ["EMAIL_ID"],
        },
        query[2],
      ],
      [
        "Email/get",
        {
          accountId,
          state: "EMAIL_STATE",
          list: [{ id: "EMAIL_ID", subject: "Hello" }],
          notFound: [],
        },
        get[2],
      ],
    ],
    sessionState: "SESSION_STATE",
  });
};
// #endregion transport

// #region exercise
try {
  const client = new JsonMetaClient({
    sessionUrl: `${host}/.well-known/jmap`,
    auth: { token: "TEST_TOKEN" },
    capabilities: ["mail"],
  });
  const query = client.api.Email.query({ limit: 1 });
  const emails = await client.api.Email.get({
    ids: query.resultRef("/ids"),
    properties: ["id", "subject"],
  });
  assert.equal(emails.list[0]?.subject, "Hello");
  assert.equal(batches, 1);

  failNext = true;
  const failedQuery = client.api.Email.query({ limit: 1 });
  const failedGet = client.api.Email.get({
    ids: failedQuery.resultRef("/ids"),
    properties: ["id", "subject"],
  });
  // Attach rejection handlers to producer and consumer together.
  await assert.rejects(Promise.all([failedQuery, failedGet]), JmapError);
  assert.equal(batches, 2);
  console.log("Mocked batch, result reference, and method failure passed.");
} finally {
  globalThis.fetch = originalFetch;
}
// #endregion exercise
