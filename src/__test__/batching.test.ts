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
    auth: "token",
    capabilities: [mail],
  });

  beforeEach(async () => {
    client = new JsonMetaClient({
      sessionUrl: `${host}/session`,
      auth: "token",
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

    it("cancels every isolated batch the callback cancels", async () => {
      const results = await client.isolated(async (api, cancel) => {
        const first = api.Email.query({ limit: 1 });
        cancel();
        const firstResult = await first.catch((error: unknown) => error);
        const second = api.Email.query({ limit: 2 });
        cancel();
        const secondResult = await second.catch((error: unknown) => error);
        return [firstResult, secondResult];
      });

      expect(results).toEqual([expect.any(CancellationError), expect.any(CancellationError)]);
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

    it("cancels a later batch after an earlier cancel", async () => {
      const first = client.api.Email.query({ limit: 1 });
      client.cancelBatch();
      await expect(first).rejects.toThrow(CancellationError);

      const second = client.api.Email.query({ limit: 2 });
      client.cancelBatch();
      await expect(second).rejects.toThrow(CancellationError);
    });
  });
});
