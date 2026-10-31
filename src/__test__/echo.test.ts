import nock from "nock";
import { afterEach, expect, it } from "vitest";

import { JsonMetaClient } from "../client.ts";
import { apiUrl, bearerToken, host, mockSession, sessionUrl } from "./fixtures.ts";

afterEach(() => nock.cleanAll());

it("sends Core/echo arguments without injecting an account", async () => {
  mockSession();
  const scope = nock(host)
    .post(new URL(apiUrl).pathname, {
      using: ["urn:ietf:params:jmap:core"],
      methodCalls: [["Core/echo", { hello: "world" }, "echo"]],
    })
    .reply(200, {
      methodResponses: [["Core/echo", { hello: "world" }, "echo"]],
      sessionState: "state",
    });
  const client = new JsonMetaClient({ bearerToken, sessionUrl, capabilities: [] });
  expect(await client.api.Core.echo({ hello: "world" }, { id: "echo" })).toEqual({
    hello: "world",
  });
  expect(scope.isDone()).toBe(true);
});
