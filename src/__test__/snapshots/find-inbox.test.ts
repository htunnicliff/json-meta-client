import { expect, test } from "vitest";

import { JsonMetaClient } from "../../client.ts";
import { bearerToken, mockApi, mockSession, sessionState, sessionUrl } from "../fixtures.ts";

test("find inbox query", async () => {
  mockSession();

  let requestBody: unknown;

  const client = new JsonMetaClient({
    bearerToken,
    sessionUrl,
    capabilities: ["mail"],
    hooks: {
      beforeRequest: [
        async ({ request }) => {
          if (request.url === sessionUrl) {
            return request;
          }
          requestBody = await request.clone().json();
          return request;
        },
      ],
    },
  });

  const query = client.api.Mailbox.query(
    {
      filter: { role: "inbox" },
      limit: 1,
    },
    { id: "<snapshot-id>" },
  );

  mockApi({
    methodResponses: [[query.$method, {}, query.$id]],
    sessionState,
  });

  await query;

  expect(requestBody).toMatchInlineSnapshot(`
    {
      "methodCalls": [
        [
          "Mailbox/query",
          {
            "accountId": "<primary-account-id>",
            "filter": {
              "role": "inbox",
            },
            "limit": 1,
          },
          "<snapshot-id>",
        ],
      ],
      "using": [
        "urn:ietf:params:jmap:core",
        "urn:ietf:params:jmap:mail",
      ],
    }
  `);
});
