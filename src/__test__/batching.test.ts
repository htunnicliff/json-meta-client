// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import { isDeepStrictEqual } from "node:util";

import nock from "nock";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { core } from "../capabilities/core.ts";
import { mail } from "../capabilities/mail.ts";
import { JsonMetaClient } from "../client.ts";
import { CancellationError } from "../errors.ts";
import type { Request as JMAPRequest, Response as JMAPResponse } from "../rfc-types/core/index.ts";

const host = "https://batching.test";
const accountId = "account";
const session = {
  apiUrl: `${host}/api`,
  uploadUrl: `${host}/upload/{accountId}`,
  downloadUrl: `${host}/download/{accountId}/{blobId}`,
  eventSourceUrl: `${host}/events`,
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
  let client = new JsonMetaClient({
    sessionUrl: `${host}/session`,
    bearerToken: "token",
    capabilities: [mail],
  });

  beforeEach(async () => {
    client = new JsonMetaClient({
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
        ["Email/query", { accountId, limit: 1 }, a.$id],
        ["Mailbox/query", { accountId, limit: 2 }, b.$id],
        ["Email/query", { accountId, limit: 3 }, c.$id],
      ],
      [
        ["Email/query", { ids: [c.$id] }, c.$id],
        ["Mailbox/query", { ids: [b.$id] }, b.$id],
        ["Email/query", { ids: [a.$id] }, a.$id],
      ],
    );

    await expect(a).resolves.toEqual({ ids: [a.$id] });
    await expect(b).resolves.toEqual({ ids: [b.$id] });
    await expect(c).resolves.toEqual({ ids: [c.$id] });
  });

  it("sends a call issued after awaiting another call in a separate request", async () => {
    const a = client.api.Email.query({ limit: 1 });
    reply([["Email/query", { accountId, limit: 1 }, a.$id]]);
    await a;
    const b = client.api.Email.query({ limit: 2 });
    reply([["Email/query", { accountId, limit: 2 }, b.$id]]);
    await expect(b).resolves.toEqual({ ids: [b.$id] });
  });

  it("separates calls in successive microtasks after the first flush boundary", async () => {
    const a = await Promise.resolve().then(() => {
      const call = client.api.Email.query({ limit: 1 });
      reply([["Email/query", { accountId, limit: 1 }, call.$id]]);
      return { call };
    });
    const b = await Promise.resolve().then(() => {
      const call = client.api.Email.query({ limit: 2 });
      reply([["Email/query", { accountId, limit: 2 }, call.$id]]);
      return { call };
    });
    await expect(a.call).resolves.toEqual({ ids: [a.call.$id] });
    await expect(b.call).resolves.toEqual({ ids: [b.call.$id] });
  });

  it("includes a call from a microtask queued before the flush boundary", async () => {
    const next = Promise.withResolvers<{ call: typeof a }>();
    queueMicrotask(() => {
      const call = client.api.Email.query({ limit: 2 });
      reply([
        ["Email/query", { accountId, limit: 1 }, a.$id],
        ["Email/query", { accountId, limit: 2 }, call.$id],
      ]);
      next.resolve({ call });
    });
    const a = client.api.Email.query({ limit: 1 });
    const { call: b } = await next.promise;
    await expect(Promise.all([a, b])).resolves.toEqual([{ ids: [a.$id] }, { ids: [b.$id] }]);
  });

  it("starts a separate request for a call queued while the earlier request is in flight", async () => {
    const firstReceived = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const a = client.api.Email.query({ limit: 1 });
    nock(host)
      .post("/api", request([["Email/query", { accountId, limit: 1 }, a.$id]]))
      .reply(async () => {
        firstReceived.resolve();
        await release.promise;
        return [
          200,
          { methodResponses: [["Email/query", { ids: [a.$id] }, a.$id]], sessionState: "state" },
        ];
      });
    await firstReceived.promise;
    const b = client.api.Email.query({ limit: 2 });
    reply([["Email/query", { accountId, limit: 2 }, b.$id]]);
    try {
      await expect(b).resolves.toEqual({ ids: [b.$id] });
    } finally {
      release.resolve();
    }
    await expect(a).resolves.toEqual({ ids: [a.$id] });
  });

  it("keeps multiple references to one pending call in the same request", async () => {
    const query = client.api.Email.query({ limit: 1 });
    const first = client.api.Email.get({ ids: query.resultRef("/ids") });
    const second = client.api.Email.get({ ids: query.resultRef("/ids"), properties: ["id"] });
    const reference = { name: "Email/query", resultOf: query.$id, path: "/ids" };
    reply(
      [
        ["Email/query", { accountId, limit: 1 }, query.$id],
        ["Email/get", { accountId, "#ids": reference }, first.$id],
        ["Email/get", { accountId, "#ids": reference, properties: ["id"] }, second.$id],
      ],
      [
        ["Email/query", { ids: ["email"] }, query.$id],
        ["Email/get", { list: [{ id: "email" }] }, first.$id],
        ["Email/get", { list: [{ id: "email" }] }, second.$id],
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
        ["Email/query", { accountId, limit: 1 }, a.$id],
        ["Email/query", { accountId, limit: 2 }, b.$id],
      ],
      [
        ["error", { type: "invalidArguments" }, a.$id],
        ["Email/query", { ids: [b.$id] }, b.$id],
      ],
    );
    const results = await Promise.allSettled([a, b]);
    expect(results[0]).toMatchObject({ status: "rejected", reason: { type: "invalidArguments" } });
    expect(results[1]).toEqual({ status: "fulfilled", value: { ids: [b.$id] } });
  });

  it.each(["http", "transport", "processing"])(
    "rejects all calls on a %s failure and can send a later batch",
    async (failure) => {
      const a = client.api.Email.query({ limit: 1 });
      const b = client.api.Email.query({ limit: 2 });
      const interceptor = nock(host).post(
        "/api",
        request([
          ["Email/query", { accountId, limit: 1 }, a.$id],
          ["Email/query", { accountId, limit: 2 }, b.$id],
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
      reply([["Email/query", { accountId, limit: 3 }, c.$id]]);
      await expect(c).resolves.toEqual({ ids: [c.$id] });
    },
  );

  describe("isolated", () => {
    it("returns the callback's synchronous result unchanged", () => {
      const result = { value: "result" };

      expect(client.isolated(() => result)).toBe(result);
    });

    it("returns the callback's promise unchanged", async () => {
      const result = Promise.resolve("result");
      const isolated = client.isolated(() => result);

      expect(isolated).toBe(result);
      await expect(isolated).resolves.toBe("result");
    });

    it("propagates a synchronous callback error", () => {
      const error = new Error("Callback failed");

      expect(() =>
        client.isolated(() => {
          throw error;
        }),
      ).toThrow(error);
    });

    it("propagates an asynchronous callback error", async () => {
      const error = new Error("Callback failed");

      await expect(
        client.isolated(async () => {
          throw error;
        }),
      ).rejects.toBe(error);
    });

    it("batches calls and result references separately from the default queue and other isolated calls", async () => {
      const before = client.api.Email.query({ limit: 1 });
      const first = client.isolated((api) => {
        const query = api.Email.query({ limit: 2 });
        const get = api.Email.get({ ids: query.resultRef("/ids") });
        reply([
          ["Email/query", { accountId, limit: 2 }, query.$id],
          [
            "Email/get",
            { accountId, "#ids": { name: "Email/query", resultOf: query.$id, path: "/ids" } },
            get.$id,
          ],
        ]);
        return { query, get };
      });
      const second = client.isolated((api) => {
        const email = api.Email.query({ limit: 3 });
        const mailbox = api.Mailbox.query({ limit: 4 });
        reply([
          ["Email/query", { accountId, limit: 3 }, email.$id],
          ["Mailbox/query", { accountId, limit: 4 }, mailbox.$id],
        ]);
        return { email, mailbox };
      });
      const after = client.api.Mailbox.query({ limit: 5 });
      reply([
        ["Email/query", { accountId, limit: 1 }, before.$id],
        ["Mailbox/query", { accountId, limit: 5 }, after.$id],
      ]);

      await expect(
        Promise.all([before, first.query, first.get, second.email, second.mailbox, after]),
      ).resolves.toEqual([
        { ids: [before.$id] },
        { ids: [first.query.$id] },
        { ids: [first.get.$id] },
        { ids: [second.email.$id] },
        { ids: [second.mailbox.$id] },
        { ids: [after.$id] },
      ]);
    });

    it("cancels isolated calls without affecting the default queue or other isolated queues", async () => {
      const regular = client.api.Email.query({ limit: 1 });
      reply([["Email/query", { accountId, limit: 1 }, regular.$id]]);
      const sibling = client.isolated((api) => {
        const call = api.Email.query({ limit: 4 });
        reply([["Email/query", { accountId, limit: 4 }, call.$id]]);
        return call;
      });
      const isolated = client.isolated((api, cancel) => {
        const email = api.Email.query({ limit: 2 });
        const mailbox = api.Mailbox.query({ limit: 3 });
        cancel();
        return Promise.allSettled([email, mailbox]);
      });

      await expect(isolated).resolves.toEqual([
        { status: "rejected", reason: expect.any(CancellationError) },
        { status: "rejected", reason: expect.any(CancellationError) },
      ]);
      await expect(regular).resolves.toEqual({ ids: [regular.$id] });
      await expect(sibling).resolves.toEqual({ ids: [sibling.$id] });
    });

    it("keeps isolated calls queued when the default batch is cancelled", async () => {
      const regular = client.api.Email.query({ limit: 1 });
      const isolated = client.isolated((api) => {
        const call = api.Email.query({ limit: 2 });
        reply([["Email/query", { accountId, limit: 2 }, call.$id]]);
        return call;
      });

      client.cancelBatch();

      await expect(regular).rejects.toThrow(CancellationError);
      await expect(isolated).resolves.toEqual({ ids: [isolated.$id] });
    });
  });

  describe("cancelBatch", () => {
    it("rejects queued calls without sending their batch", async () => {
      const email = client.api.Email.query({ limit: 1 });
      const mailbox = client.api.Mailbox.query({ limit: 2 });

      client.cancelBatch();

      await expect(Promise.allSettled([email, mailbox])).resolves.toEqual([
        {
          status: "rejected",
          reason: expect.any(CancellationError),
        },
        {
          status: "rejected",
          reason: expect.any(CancellationError),
        },
      ]);
      expect(nock.pendingMocks()).toEqual([]);
    });

    it("allows calls in a later batch to complete", async () => {
      const cancelled = client.api.Email.query({ limit: 1 });
      client.cancelBatch();
      await expect(cancelled).rejects.toThrow(CancellationError);

      const completed = client.api.Email.query({ limit: 2 });
      reply([["Email/query", { accountId, limit: 2 }, completed.$id]]);

      await expect(completed).resolves.toEqual({ ids: [completed.$id] });
    });
  });
});
