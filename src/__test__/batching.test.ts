import { isDeepStrictEqual } from "node:util";

import type { Request as JMAPRequest, Response as JMAPResponse } from "jmap-rfc-types";
import nock from "nock";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { core } from "../capabilities/core.ts";
import { mail } from "../capabilities/mail.ts";
import { Client } from "../client.ts";
import { ref } from "../ref.ts";

const host = "https://batching.test";
const accountId = "account";
const session = {
  apiUrl: `${host}/api`,
  primaryAccounts: { [mail.urn]: accountId },
  capabilities: {
    [core.urn]: { maxCallsInRequest: 1, maxSizeRequest: 1 },
    [mail.urn]: {},
  },
};

function request(methodCalls: JMAPRequest["methodCalls"]) {
  const expected: JMAPRequest = { using: [core.urn, mail.urn], methodCalls };
  return (body: unknown) => isDeepStrictEqual(body, expected);
}

function reply(
  methodCalls: JMAPRequest["methodCalls"],
  methodResponses?: JMAPResponse["methodResponses"],
) {
  return nock(host)
    .post("/api", request(methodCalls))
    .reply(200, {
      methodResponses:
        methodResponses ?? methodCalls.map(([method, , id]) => [method, { ids: [id] }, id]),
      sessionState: "state",
    });
}

describe("client batching contract", () => {
  let client = new Client({
    sessionUrl: `${host}/session`,
    bearerToken: "token",
    capabilities: [mail],
  });

  beforeEach(async () => {
    client = new Client({
      sessionUrl: `${host}/session`,
      bearerToken: "token",
      capabilities: [mail],
    });
    nock(host).get("/session").reply(200, session);
    await client.session;
  });

  afterEach(() => {
    const pending = nock.pendingMocks();
    nock.cleanAll();
    if (pending.length > 0) throw new Error(`Unsent requests: ${pending.join(", ")}`);
  });

  it("sends synchronous independent calls in order in one request, even above advertised limits", async () => {
    const a = client.api.Email.query({ limit: 1 });
    const b = client.api.Mailbox.query({ limit: 2 });
    const c = client.api.Email.query({ limit: 3 });
    reply(
      [
        ["Email/query", { accountId, limit: 1 }, a.id],
        ["Mailbox/query", { accountId, limit: 2 }, b.id],
        ["Email/query", { accountId, limit: 3 }, c.id],
      ],
      [
        ["Email/query", { ids: [c.id] }, c.id],
        ["Mailbox/query", { ids: [b.id] }, b.id],
        ["Email/query", { ids: [a.id] }, a.id],
      ],
    );

    await expect(a).resolves.toEqual({ ids: [a.id] });
    await expect(b).resolves.toEqual({ ids: [b.id] });
    await expect(c).resolves.toEqual({ ids: [c.id] });
  });

  it("sends a call issued after awaiting another call in a separate request", async () => {
    const a = client.api.Email.query({ limit: 1 });
    reply([["Email/query", { accountId, limit: 1 }, a.id]]);
    await a;
    const b = client.api.Email.query({ limit: 2 });
    reply([["Email/query", { accountId, limit: 2 }, b.id]]);
    await expect(b).resolves.toEqual({ ids: [b.id] });
  });

  it("separates calls in successive microtasks after the first flush boundary", async () => {
    const a = await Promise.resolve().then(() => {
      const call = client.api.Email.query({ limit: 1 });
      reply([["Email/query", { accountId, limit: 1 }, call.id]]);
      return { call };
    });
    const b = await Promise.resolve().then(() => {
      const call = client.api.Email.query({ limit: 2 });
      reply([["Email/query", { accountId, limit: 2 }, call.id]]);
      return { call };
    });
    await expect(a.call).resolves.toEqual({ ids: [a.call.id] });
    await expect(b.call).resolves.toEqual({ ids: [b.call.id] });
  });

  it("includes a call from a microtask queued before the flush boundary", async () => {
    const next = Promise.withResolvers<{ call: typeof a }>();
    queueMicrotask(() => {
      const call = client.api.Email.query({ limit: 2 });
      reply([
        ["Email/query", { accountId, limit: 1 }, a.id],
        ["Email/query", { accountId, limit: 2 }, call.id],
      ]);
      next.resolve({ call });
    });
    const a = client.api.Email.query({ limit: 1 });
    const { call: b } = await next.promise;
    await expect(Promise.all([a, b])).resolves.toEqual([{ ids: [a.id] }, { ids: [b.id] }]);
  });

  it("starts a separate request for a call queued while the earlier request is in flight", async () => {
    const firstReceived = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const a = client.api.Email.query({ limit: 1 });
    nock(host)
      .post("/api", request([["Email/query", { accountId, limit: 1 }, a.id]]))
      .reply(async () => {
        firstReceived.resolve();
        await release.promise;
        return [
          200,
          { methodResponses: [["Email/query", { ids: [a.id] }, a.id]], sessionState: "state" },
        ];
      });
    await firstReceived.promise;
    const b = client.api.Email.query({ limit: 2 });
    reply([["Email/query", { accountId, limit: 2 }, b.id]]);
    try {
      await expect(b).resolves.toEqual({ ids: [b.id] });
    } finally {
      release.resolve();
    }
    await expect(a).resolves.toEqual({ ids: [a.id] });
  });

  it("keeps multiple references to one pending call in the same request", async () => {
    const query = client.api.Email.query({ limit: 1 });
    const first = client.api.Email.get({ ids: ref(query, "/ids") });
    const second = client.api.Email.get({ ids: ref(query, "/ids"), properties: ["id"] });
    const reference = { name: "Email/query", resultOf: query.id, path: "/ids" };
    reply(
      [
        ["Email/query", { accountId, limit: 1 }, query.id],
        ["Email/get", { accountId, "#ids": reference }, first.id],
        ["Email/get", { accountId, "#ids": reference, properties: ["id"] }, second.id],
      ],
      [
        ["Email/query", { ids: ["email"] }, query.id],
        ["Email/get", { list: [{ id: "email" }] }, first.id],
        ["Email/get", { list: [{ id: "email" }] }, second.id],
      ],
    );
    await expect(Promise.all([query, first, second])).resolves.toEqual([
      { ids: ["email"] },
      { list: [{ id: "email" }] },
      { list: [{ id: "email" }] },
    ]);
  });

  it("rejects only the failed method while resolving successful calls in that request", async () => {
    const a = client.api.Email.query({ limit: 1 });
    const b = client.api.Email.query({ limit: 2 });
    reply(
      [
        ["Email/query", { accountId, limit: 1 }, a.id],
        ["Email/query", { accountId, limit: 2 }, b.id],
      ],
      [
        ["error", { type: "invalidArguments" }, a.id],
        ["Email/query", { ids: [b.id] }, b.id],
      ],
    );
    const results = await Promise.allSettled([a, b]);
    expect(results[0]).toMatchObject({ status: "rejected", reason: { type: "invalidArguments" } });
    expect(results[1]).toEqual({ status: "fulfilled", value: { ids: [b.id] } });
  });

  it.each(["http", "transport", "processing"])(
    "rejects all calls on a %s failure and can send a later batch",
    async (failure) => {
      const a = client.api.Email.query({ limit: 1 });
      const b = client.api.Email.query({ limit: 2 });
      const interceptor = nock(host).post(
        "/api",
        request([
          ["Email/query", { accountId, limit: 1 }, a.id],
          ["Email/query", { accountId, limit: 2 }, b.id],
        ]),
      );
      if (failure === "http") interceptor.reply(503, { type: "serverFail" });
      else if (failure === "transport") interceptor.replyWithError("Connection closed");
      else interceptor.reply(200, { methodResponses: null });
      const results = await Promise.allSettled([a, b]);
      expect(results[0]?.status).toBe("rejected");
      expect(results[1]?.status).toBe("rejected");
      const reasons = results.map((result) =>
        result.status === "rejected" ? result.reason : undefined,
      );
      expect(reasons[0]).toBe(reasons[1]);
      const c = client.api.Email.query({ limit: 3 });
      reply([["Email/query", { accountId, limit: 3 }, c.id]]);
      await expect(c).resolves.toEqual({ ids: [c.id] });
    },
  );
});
