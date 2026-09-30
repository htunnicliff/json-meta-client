import assert from "node:assert/strict";

import { Client, ref } from "json-meta-client";
import { core, mail } from "json-meta-client/capabilities";

export async function checkEcho() {
  const originalFetch = globalThis.fetch;
  const methods = [];
  const requests = [];
  globalThis.fetch = async (url, init) => {
    if (!init?.body) {
      return Response.json({
        apiUrl: "https://example.test/api",
        uploadUrl: "https://example.test/upload/{accountId}",
        downloadUrl: "https://example.test/download/{accountId}/{blobId}",
        eventSourceUrl: "https://example.test/events",
        primaryAccounts: { [mail.urn]: "mail-account" },
        accounts: {
          "mail-account": {
            name: "Mail",
            isPersonal: true,
            isReadOnly: false,
            accountCapabilities: { [mail.urn]: {} },
          },
        },
        capabilities: {
          [core.urn]: {
            maxCallsInRequest: 16,
            maxConcurrentRequests: 4,
            maxSizeRequest: 1048576,
            maxObjectsInGet: 100,
            maxObjectsInSet: 100,
            maxSizeUpload: 1048576,
          },
          [mail.urn]: {},
        },
        sessionState: "session",
      });
    }
    const request = JSON.parse(init.body);
    requests.push(request);
    return Response.json({ methodResponses: request.methodCalls, sessionState: "session" });
  };
  try {
    const client = new Client({
      sessionUrl: "https://example.test/session",
      bearerToken: "token",
      capabilities: [mail],
      middleware: [
        (payload, context) => {
          methods.push(context?.method);
          return payload;
        },
      ],
    });
    const pending = client.api.Core.echo({ hello: true, high: 5 });
    assert.equal(pending.method, "Core/echo");
    assert.deepEqual(await pending, { hello: true, high: 5 });
    assert.deepEqual(requests[0].methodCalls[0][1], { hello: true, high: 5 });
    assert.deepEqual(methods, ["Core/echo"]);
    assert.deepEqual(requests[0].using, [core.urn]);
    const reference = ref(pending, "/high");
    assert.equal(reference.path, "/high");
    assert.equal(reference.resultOf, pending.id);
    const accountSource = client.api.Core.echo({ accountId: "referenced-account" });
    const query = client.api.Mailbox.query({ accountId: ref(accountSource, "/accountId") });
    await Promise.all([accountSource, query]);
    assert.deepEqual(requests[1].methodCalls[1][1], {
      "#accountId": { name: "Core/echo", resultOf: accountSource.id, path: "/accountId" },
    });
    assert.deepEqual(requests[1].using, [core.urn, mail.urn]);
  } finally {
    globalThis.fetch = originalFetch;
  }
}
