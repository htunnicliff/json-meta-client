// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import { describe, expect, it } from "vitest";

import { coreSessionCapabilities, makeSession } from "../../__test__/fixtures.ts";
import { core } from "../../capabilities/core.ts";
import { CancellationError, JmapError, MethodCallError } from "../../errors.ts";
import type {
  Request as JmapRequest,
  Response as JmapResponse,
} from "../../rfc-types/core/index.ts";
import { Dispatcher } from "../dispatcher.ts";
import type { DispatcherOptions } from "../dispatcher.ts";
import { MethodCall } from "../method-call.ts";

/**
 * Answers each method call with its own call id, the way a well-behaved
 * server answers a request
 */
function echo(request: JmapRequest): JmapResponse {
  return {
    methodResponses: request.methodCalls.map(([method, , id]) => [method, { echo: id }, id]),
    sessionState: "state",
  };
}

/**
 * Answers every request with the given method responses
 */
function respondWith(methodResponses: JmapResponse["methodResponses"]) {
  return (): JmapResponse => ({ methodResponses, sessionState: "state" });
}

/**
 * A Dispatcher whose transport records every request it receives and
 * answers in memory
 */
function setup(options: Partial<DispatcherOptions> & { respond?: typeof echo } = {}) {
  const { respond = echo, ...overrides } = options;
  const requests: JmapRequest[] = [];
  const dispatcher = new Dispatcher({
    transport: async (request) => {
      requests.push(request);
      return respond(request);
    },
    session: async () => makeSession(),
    urnsForEntity: () => [],
    ...overrides,
  });
  return { dispatcher, requests };
}

function call(method: string, id: string, args: object = {}): MethodCall<object> {
  return new MethodCall({ method, args, id });
}

/**
 * The call ids of each request's method calls, one list per request
 */
function callIds(requests: JmapRequest[]): string[][] {
  return requests.map(({ methodCalls }) => methodCalls.map(([, , id]) => id));
}

describe(Dispatcher, () => {
  describe("batching", () => {
    it("sends method calls made in the same tick as one request", async () => {
      const { dispatcher, requests } = setup();

      const results = await Promise.all([
        dispatcher.send(call("Core/echo", "a", { value: 1 })),
        dispatcher.send(call("Core/echo", "b", { value: 2 })),
      ]);

      expect(results).toEqual([{ echo: "a" }, { echo: "b" }]);
      expect(requests).toEqual([
        {
          using: [core.urn],
          methodCalls: [
            ["Core/echo", { value: 1 }, "a"],
            ["Core/echo", { value: 2 }, "b"],
          ],
        },
      ]);
    });

    it("sends the whole batch even above the session's maxCallsInRequest", async () => {
      const session = makeSession();
      session.capabilities[core.urn] = { ...coreSessionCapabilities, maxCallsInRequest: 1 };
      const { dispatcher, requests } = setup({ session: async () => session });

      await Promise.all([
        dispatcher.send(call("Core/echo", "a")),
        dispatcher.send(call("Core/echo", "b")),
      ]);

      expect(requests).toHaveLength(1);
    });

    it("includes a method call from a microtask queued before the batch's first call", async () => {
      const { dispatcher, requests } = setup();

      const later = Promise.withResolvers<unknown>();
      queueMicrotask(() => later.resolve(dispatcher.send(call("Core/echo", "b"))));
      const first = dispatcher.send(call("Core/echo", "a"));

      await expect(Promise.all([first, later.promise])).resolves.toEqual([
        { echo: "a" },
        { echo: "b" },
      ]);
      expect(callIds(requests)).toEqual([["a", "b"]]);
    });

    it("sends method calls made in successive microtasks after the batch closes separately", async () => {
      const { dispatcher, requests } = setup();

      const first = await Promise.resolve().then(() => ({
        result: dispatcher.send(call("Core/echo", "a")),
      }));
      const second = await Promise.resolve().then(() => ({
        result: dispatcher.send(call("Core/echo", "b")),
      }));

      await Promise.all([first.result, second.result]);
      expect(callIds(requests)).toEqual([["a"], ["b"]]);
    });

    it("sends a method call made in a later tick as a new request", async () => {
      const { dispatcher, requests } = setup();

      await dispatcher.send(call("Core/echo", "a"));
      await dispatcher.send(call("Core/echo", "b"));

      expect(callIds(requests)).toEqual([["a"], ["b"]]);
    });

    it("sends a method call made while a batch is in flight as a new request", async () => {
      const release = Promise.withResolvers<void>();
      const { dispatcher, requests } = setup({
        transport: async (request) => {
          requests.push(request);
          if (request.methodCalls[0]![2] === "a") await release.promise;
          return echo(request);
        },
      });

      const first = dispatcher.send(call("Core/echo", "a"));
      await expect.poll(() => requests).toHaveLength(1);
      await expect(dispatcher.send(call("Core/echo", "b"))).resolves.toEqual({ echo: "b" });
      release.resolve();
      await expect(first).resolves.toEqual({ echo: "a" });
      expect(requests).toHaveLength(2);
    });
  });

  describe("using", () => {
    it("lists the core capability and every URN the called entities need, once each", async () => {
      const urns: Record<string, string[]> = {
        Email: ["urn:mail"],
        MDN: ["urn:mdn", "urn:mail"],
      };
      const { dispatcher, requests } = setup({ urnsForEntity: (entity) => urns[entity] ?? [] });

      await Promise.all([
        dispatcher.send(call("MDN/parse", "a")),
        dispatcher.send(call("Email/get", "b")),
        dispatcher.send(call("Core/echo", "c")),
      ]);

      expect(requests[0]!.using).toEqual([core.urn, "urn:mdn", "urn:mail"]);
    });
  });

  describe("hooks", () => {
    it("waits for the session before running beforeJmapRequest hooks", async () => {
      const events: string[] = [];
      const { dispatcher } = setup({
        session: async () => {
          await Promise.resolve();
          events.push("session");
          return makeSession();
        },
        hooks: {
          beforeJmapRequest: [
            ({ request }) => {
              events.push("beforeJmapRequest");
              return request;
            },
          ],
        },
      });

      await dispatcher.send(call("Core/echo", "a"));

      expect(events).toEqual(["session", "beforeJmapRequest"]);
    });

    it("chains beforeJmapRequest hooks in order and sends the last hook's request", async () => {
      const seen: JmapRequest[] = [];
      const { dispatcher, requests } = setup({
        hooks: {
          beforeJmapRequest: [
            async ({ request }) => {
              seen.push(request);
              return { ...request, using: [...request.using, "urn:first"] };
            },
            ({ request }) => {
              seen.push(request);
              return { ...request, createdIds: { local: "remote" } };
            },
          ],
        },
      });

      await dispatcher.send(call("Core/echo", "a"));

      const original = { using: [core.urn], methodCalls: [["Core/echo", {}, "a"]] };
      expect(seen).toEqual([original, { ...original, using: [core.urn, "urn:first"] }]);
      expect(requests).toEqual([
        { ...original, using: [core.urn, "urn:first"], createdIds: { local: "remote" } },
      ]);
    });

    it("chains afterJmapResponse hooks in order with the sent request before settling calls", async () => {
      const seen: { request: JmapRequest; response: JmapResponse }[] = [];
      const { dispatcher, requests } = setup({
        hooks: {
          beforeJmapRequest: [({ request }) => ({ ...request, createdIds: {} })],
          afterJmapResponse: [
            async ({ request, response }) => {
              seen.push({ request, response });
              return { ...response, methodResponses: [["Core/echo", { changed: 1 }, "a"]] };
            },
            ({ request, response }) => {
              seen.push({ request, response });
              return { ...response, methodResponses: [["Core/echo", { changed: 2 }, "a"]] };
            },
          ],
        },
      });

      await expect(dispatcher.send(call("Core/echo", "a"))).resolves.toEqual({ changed: 2 });

      const sent = requests[0]!;
      expect(sent.createdIds).toEqual({});
      expect(seen).toEqual([
        { request: sent, response: echo(sent) },
        {
          request: sent,
          response: { ...echo(sent), methodResponses: [["Core/echo", { changed: 1 }, "a"]] },
        },
      ]);
    });
  });

  describe("settling method calls", () => {
    it("matches responses to method calls by call id, in any order", async () => {
      const { dispatcher } = setup({
        respond: respondWith([
          ["Mailbox/query", { ids: ["mailbox"] }, "b"],
          ["Email/query", { ids: ["email"] }, "a"],
        ]),
      });

      await expect(
        Promise.all([
          dispatcher.send(call("Email/query", "a")),
          dispatcher.send(call("Mailbox/query", "b")),
        ]),
      ).resolves.toEqual([{ ids: ["email"] }, { ids: ["mailbox"] }]);
    });

    it("chooses the response with the call's method name among several with its call id", async () => {
      const { dispatcher } = setup({
        respond: respondWith([
          ["Email/copy", { created: { x: {} } }, "a"],
          ["Email/set", { destroyed: ["x"] }, "a"],
        ]),
      });

      await expect(dispatcher.send(call("Email/set", "a"))).resolves.toEqual({
        destroyed: ["x"],
      });
    });

    it("chooses an error response over a different method's response with the same call id", async () => {
      const { dispatcher } = setup({
        respond: respondWith([
          ["Email/set", { destroyed: [] }, "a"],
          ["error", { type: "invalidArguments" }, "a"],
        ]),
      });

      await expect(dispatcher.send(call("Email/copy", "a"))).rejects.toMatchObject({
        name: "JmapError",
        type: "invalidArguments",
      });
    });

    it("rejects with a JmapError carrying the method call for a problem-details error", async () => {
      const methodCall = call("Email/query", "a", { limit: 1 });
      const cause = { type: "invalidArguments", detail: "limit must be positive" };
      const { dispatcher } = setup({ respond: respondWith([["error", cause, "a"]]) });

      const error = await dispatcher.send(methodCall).catch((error: unknown) => error);

      expect(error).toBeInstanceOf(JmapError);
      expect(error).toMatchObject({
        message: "Error in method call",
        type: "invalidArguments",
        detail: "limit must be positive",
        cause,
        methodCall,
      });
    });

    it("rejects with a MethodCallError carrying the raw data for an error without problem details", async () => {
      const methodCall = call("Email/query", "a");
      const responseData = { detail: "missing error type" };
      const { dispatcher } = setup({ respond: respondWith([["error", responseData, "a"]]) });

      const error = await dispatcher.send(methodCall).catch((error: unknown) => error);

      expect(error).toBeInstanceOf(MethodCallError);
      expect(error).not.toBeInstanceOf(JmapError);
      expect(error).toMatchObject({
        message: "Unknown error in method call",
        methodCall,
        responseData,
      });
    });

    it("rejects with a MethodCallError when the response has a different method name", async () => {
      const methodCall = call("Mailbox/query", "a");
      const { dispatcher } = setup({ respond: respondWith([["Email/query", { ids: [] }, "a"]]) });

      const error = await dispatcher.send(methodCall).catch((error: unknown) => error);

      expect(error).toBeInstanceOf(MethodCallError);
      expect(error).toMatchObject({
        message: 'Unexpected response method "Email/query" for "Mailbox/query"',
        methodCall,
        responseData: { ids: [] },
      });
    });

    it("rejects with a MethodCallError naming the call id when no response has it", async () => {
      const methodCall = call("Email/query", "b");
      const { dispatcher } = setup({ respond: respondWith([["Email/query", { ids: [] }, "a"]]) });

      const results = await Promise.allSettled([
        dispatcher.send(call("Email/query", "a")),
        dispatcher.send(methodCall),
      ]);

      expect(results[0]).toEqual({ status: "fulfilled", value: { ids: [] } });
      expect(results[1]).toEqual({ status: "rejected", reason: expect.any(MethodCallError) });
      expect(results[1]).toMatchObject({
        reason: {
          message: 'No response for method call "b"',
          methodCall,
          responseData: undefined,
        },
      });
    });
  });

  describe("batch failures", () => {
    const failure = new Error("Batch failed");
    const fail = (): never => {
      throw failure;
    };

    it.each<[string, Partial<DispatcherOptions>]>([
      ["the session fails to load", { session: async () => fail() }],
      ["the transport fails", { transport: async () => fail() }],
      ["a beforeJmapRequest hook fails", { hooks: { beforeJmapRequest: [fail] } }],
      ["an afterJmapResponse hook fails", { hooks: { afterJmapResponse: [fail] } }],
    ])("rejects every method call in the batch when %s", async (_, options) => {
      const { dispatcher } = setup(options);

      const results = await Promise.allSettled([
        dispatcher.send(call("Core/echo", "a")),
        dispatcher.send(call("Core/echo", "b")),
      ]);

      expect(results).toEqual([
        { status: "rejected", reason: failure },
        { status: "rejected", reason: failure },
      ]);
    });

    it("rejects every method call in the batch when the response cannot be read", async () => {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const { dispatcher } = setup({ respond: () => ({ methodResponses: null }) as never });

      const results = await Promise.allSettled([
        dispatcher.send(call("Core/echo", "a")),
        dispatcher.send(call("Core/echo", "b")),
      ]);

      expect(results).toEqual([
        { status: "rejected", reason: expect.any(TypeError) },
        { status: "rejected", reason: expect.any(TypeError) },
      ]);
      if (results[0].status !== "rejected" || results[1].status !== "rejected") return;
      expect(results[1].reason).toBe(results[0].reason);
    });

    it("sends a later batch normally after a failed one", async () => {
      let attempts = 0;
      const { dispatcher } = setup({
        transport: async (request) => {
          attempts++;
          if (attempts === 1) throw failure;
          return echo(request);
        },
      });

      await expect(dispatcher.send(call("Core/echo", "a"))).rejects.toBe(failure);
      await expect(dispatcher.send(call("Core/echo", "b"))).resolves.toEqual({ echo: "b" });
    });
  });

  describe("cancel", () => {
    it("rejects the method calls waiting in the current batch without sending them", async () => {
      const { dispatcher, requests } = setup();

      const pending = Promise.allSettled([
        dispatcher.send(call("Core/echo", "a")),
        dispatcher.send(call("Core/echo", "b")),
      ]);
      dispatcher.cancel();

      await expect(pending).resolves.toEqual([
        { status: "rejected", reason: expect.any(CancellationError) },
        { status: "rejected", reason: expect.any(CancellationError) },
      ]);
      expect(requests).toEqual([]);
    });

    it("cancels a later batch after an earlier cancel", async () => {
      const { dispatcher, requests } = setup();

      const first = dispatcher.send(call("Core/echo", "a"));
      dispatcher.cancel();
      await expect(first).rejects.toThrow(CancellationError);

      const second = dispatcher.send(call("Core/echo", "b"));
      dispatcher.cancel();
      await expect(second).rejects.toThrow(CancellationError);

      expect(requests).toEqual([]);
    });

    it("leaves a batch that is already being sent to settle normally", async () => {
      const release = Promise.withResolvers<void>();
      const { dispatcher, requests } = setup({
        transport: async (request) => {
          requests.push(request);
          await release.promise;
          return echo(request);
        },
      });

      const sent = dispatcher.send(call("Core/echo", "a"));
      await expect.poll(() => requests).toHaveLength(1);
      dispatcher.cancel();
      release.resolve();

      await expect(sent).resolves.toEqual({ echo: "a" });
    });

    it("sends method calls made after a cancel in a new batch", async () => {
      const { dispatcher, requests } = setup();

      const cancelled = dispatcher.send(call("Core/echo", "a"));
      dispatcher.cancel();
      const sent = dispatcher.send(call("Core/echo", "b"));

      await expect(cancelled).rejects.toThrow(CancellationError);
      await expect(sent).resolves.toEqual({ echo: "b" });
      expect(requests).toEqual([{ using: [core.urn], methodCalls: [["Core/echo", {}, "b"]] }]);
    });
  });
});
