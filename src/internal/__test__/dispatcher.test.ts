import { describe, expect, it, vi } from "vitest";

import { coreSessionCapabilities, makeSession } from "../../__test__/fixtures.ts";
import { core } from "../../capabilities/core.ts";
import {
  CancellationError,
  ConfigurationError,
  CreationReferenceError,
  JmapError,
  JsonMetaError,
  MethodCallError,
  NetworkError,
  UnknownError,
} from "../../errors/index.ts";
import type {
  Request as JmapRequest,
  Response as JmapResponse,
  Session,
} from "../../rfc-types/core/index.ts";
import type { Transport } from "../../transports/types.ts";
import type { FindMethodOwner } from "../capability-index.ts";
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
    transport: {
      send: async (request) => {
        requests.push(request);
        return respond(request);
      },
    },
    session: async () => makeSession(),
    signal: new AbortController().signal,
    urnsForEntity: () => [],
    findMethodOwner: () => undefined,
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

/** A session whose only primary account is mail's, with two contacts accounts */
function ambiguousContactsSession(): Session {
  const session = makeSession();
  const account = { name: "", isPersonal: true, isReadOnly: false };
  session.primaryAccounts = { "urn:mail": "mail-account" };
  session.accounts = {
    "mail-account": {
      ...account,
      accountCapabilities: { "urn:mail": {}, "urn:contacts": {} },
    },
    shared: { ...account, accountCapabilities: { "urn:contacts": {} } },
  };
  return session;
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
        transport: {
          send: async (request) => {
            requests.push(request);
            if (request.methodCalls[0]![2] === "a") {
              await release.promise;
            }
            return echo(request);
          },
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

  describe("creation IDs", () => {
    it("rejects a call that reuses a creation ID from an earlier call in its batch", async () => {
      const { dispatcher, requests } = setup();

      const mailboxes = dispatcher.send(call("Mailbox/set", "a", { create: { draft: {} } }));
      const emails = dispatcher.send(call("Email/set", "b", { create: { draft: {} } }));

      await expect(mailboxes).resolves.toEqual({ echo: "a" });
      await expect(emails).rejects.toBeInstanceOf(CreationReferenceError);
      await expect(emails).rejects.toMatchObject({ reason: "duplicate-id", creationId: "draft" });
      expect(callIds(requests)).toEqual([["a"]]);
    });

    it("shares creation IDs between /set, /copy and Email/import", async () => {
      const { dispatcher, requests } = setup();

      const set = dispatcher.send(call("Email/set", "a", { create: { one: {} } }));
      const copy = dispatcher.send(call("Email/copy", "b", { create: { one: {} } }));
      const imported = dispatcher.send(call("Email/import", "c", { emails: { one: {} } }));

      await expect(set).resolves.toEqual({ echo: "a" });
      await expect(copy).rejects.toMatchObject({ reason: "duplicate-id" });
      await expect(imported).rejects.toMatchObject({ reason: "duplicate-id" });
      expect(callIds(requests)).toEqual([["a"]]);
    });

    it("allows distinct creation IDs in one batch and reused ones across batches", async () => {
      const { dispatcher, requests } = setup();

      await Promise.all([
        dispatcher.send(call("Mailbox/set", "a", { create: { box: {} } })),
        dispatcher.send(call("Email/set", "b", { create: { draft: {} } })),
      ]);
      await dispatcher.send(call("Email/set", "c", { create: { draft: {} } }));

      expect(callIds(requests)).toEqual([["a", "b"], ["c"]]);
    });

    it("ignores the creation IDs of a call it rejects", async () => {
      const { dispatcher, requests } = setup();

      const first = dispatcher.send(call("Email/set", "a", { create: { draft: {} } }));
      const duplicate = dispatcher.send(call("Email/set", "a", { create: { other: {} } }));
      const second = dispatcher.send(call("Email/set", "b", { create: { other: {} } }));

      await expect(duplicate).rejects.toMatchObject({ reason: "duplicate-id" });
      await Promise.all([first, second]);
      expect(callIds(requests)).toEqual([["a", "b"]]);
    });
  });

  describe("isQueued", () => {
    it("is true until the batch is sent", async () => {
      const { dispatcher } = setup();
      const methodCall = call("Core/echo", "a");

      const pending = dispatcher.send(methodCall);
      expect(dispatcher.isQueued(methodCall)).toBe(true);
      await pending;
      expect(dispatcher.isQueued(methodCall)).toBe(false);
    });

    it("is false for a cancelled method call", async () => {
      const { dispatcher } = setup();
      const methodCall = call("Core/echo", "a");

      const pending = dispatcher.send(methodCall);
      dispatcher.cancel();
      expect(dispatcher.isQueued(methodCall)).toBe(false);
      await expect(pending).rejects.toBeInstanceOf(CancellationError);
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

  describe("default accounts", () => {
    const urns: Record<string, string> = { Email: "urn:mail", ContactCard: "urn:contacts" };

    /** Every `Email` and `ContactCard` method defaults to its capability's account */
    const findMethodOwner: FindMethodOwner = (name) => {
      const urn = urns[name.slice(0, name.indexOf("/"))];
      return urn === undefined ? undefined : { urn, defaultAccount: "primary" };
    };

    function setupAccounts(options: Parameters<typeof setup>[0] = {}) {
      return setup({
        session: async () => ambiguousContactsSession(),
        urnsForEntity: (entity) => [urns[entity]!],
        findMethodOwner,
        ...options,
      });
    }

    it("writes the default account onto the arguments when the batch is sent", async () => {
      const methodCall = call("Email/get", "a", { ids: ["e1"] });
      const { dispatcher, requests } = setupAccounts();

      const result = dispatcher.send(methodCall);
      expect(methodCall.args).toEqual({ ids: ["e1"] });
      await result;

      expect(methodCall.args).toEqual({ ids: ["e1"], accountId: "mail-account" });
      expect(requests[0]!.methodCalls).toEqual([
        ["Email/get", { ids: ["e1"], accountId: "mail-account" }, "a"],
      ]);
      expect(requests[0]!.methodCalls[0]![1]).toBe(methodCall.args);
    });

    it("gives beforeJmapRequest hooks the default account", async () => {
      const seen: unknown[] = [];
      const { dispatcher } = setupAccounts({
        hooks: {
          beforeJmapRequest: [
            ({ jmapRequest: request }) => {
              seen.push(structuredClone(request.methodCalls));
              return request;
            },
          ],
        },
      });

      await dispatcher.send(call("Email/get", "a"));

      expect(seen).toEqual([[["Email/get", { accountId: "mail-account" }, "a"]]]);
    });

    it.each([
      ["an accountId", { accountId: "other" }],
      ["an undefined accountId", { accountId: undefined }],
      ["a result reference for accountId", { "#accountId": { resultOf: "x" } }],
    ])("keeps %s that the method call passes", async (_, args) => {
      const { dispatcher, requests } = setupAccounts();

      await dispatcher.send(call("ContactCard/get", "a", args));

      expect(requests[0]!.methodCalls).toEqual([["ContactCard/get", args, "a"]]);
      expect(Object.keys(requests[0]!.methodCalls[0]![1])).toEqual(Object.keys(args));
    });

    it("sends a method call that no capability owns without accountId", async () => {
      const { dispatcher, requests } = setupAccounts({ urnsForEntity: () => [] });

      await dispatcher.send(call("Core/echo", "a", { hello: "world" }));

      expect(requests[0]!.methodCalls).toEqual([["Core/echo", { hello: "world" }, "a"]]);
    });

    it("rejects an ambiguous method call on its own and leaves it out of the request", async () => {
      const { dispatcher, requests } = setupAccounts();

      const results = await Promise.allSettled([
        dispatcher.send(call("ContactCard/get", "a")),
        dispatcher.send(call("Email/get", "b")),
        dispatcher.send(call("ContactCard/query", "c")),
      ]);

      expect(results).toEqual([
        { status: "rejected", reason: expect.any(ConfigurationError) },
        { status: "fulfilled", value: { echo: "b" } },
        { status: "rejected", reason: expect.any(ConfigurationError) },
      ]);
      expect(results[0]).toMatchObject({
        reason: {
          message:
            "Cannot choose a default account for ContactCard/get: several accounts support " +
            "urn:contacts, and the session names no primary account for it. " +
            "Pass `accountId` to choose one.",
        },
      });
      expect(requests).toEqual([
        {
          using: [core.urn, "urn:mail"],
          methodCalls: [["Email/get", { accountId: "mail-account" }, "b"]],
        },
      ]);
    });

    it("still sends a method call that references a rejected one", async () => {
      const reference = { name: "ContactCard/query", resultOf: "a", path: "/ids" };
      const { dispatcher, requests } = setupAccounts({
        respond: respondWith([["error", { type: "invalidResultReference" }, "b"]]),
      });

      const results = await Promise.allSettled([
        dispatcher.send(call("ContactCard/query", "a")),
        dispatcher.send(call("Email/get", "b", { "#ids": reference })),
      ]);

      expect(results).toMatchObject([
        { status: "rejected", reason: { name: "ConfigurationError" } },
        { status: "rejected", reason: { name: "JmapError", type: "invalidResultReference" } },
      ]);
      expect(requests[0]!.methodCalls).toEqual([
        ["Email/get", { "#ids": reference, accountId: "mail-account" }, "b"],
      ]);
    });

    it("sends no request and runs no hooks when every method call is rejected", async () => {
      const beforeJmapRequest = vi.fn<(args: { jmapRequest: JmapRequest }) => JmapRequest>();
      const { dispatcher, requests } = setupAccounts({
        hooks: { beforeJmapRequest: [beforeJmapRequest] },
      });

      const results = await Promise.allSettled([
        dispatcher.send(call("ContactCard/get", "a")),
        dispatcher.send(call("ContactCard/query", "b")),
      ]);

      expect(results).toEqual([
        { status: "rejected", reason: expect.any(ConfigurationError) },
        { status: "rejected", reason: expect.any(ConfigurationError) },
      ]);
      expect(requests).toEqual([]);
      expect(beforeJmapRequest).not.toHaveBeenCalled();
    });

    it("keeps an ambiguous method call's own error when the rest of the batch fails", async () => {
      const failure = new JsonMetaError("Batch failed");
      const { dispatcher } = setupAccounts({
        transport: {
          send: async () => {
            throw failure;
          },
        },
      });

      const results = await Promise.allSettled([
        dispatcher.send(call("ContactCard/get", "a")),
        dispatcher.send(call("Email/get", "b")),
      ]);

      expect(results).toEqual([
        { status: "rejected", reason: expect.any(ConfigurationError) },
        { status: "rejected", reason: failure },
      ]);
    });

    it("sends a later batch normally after rejecting an ambiguous method call", async () => {
      const { dispatcher, requests } = setupAccounts();

      await expect(dispatcher.send(call("ContactCard/get", "a"))).rejects.toThrow(
        ConfigurationError,
      );
      await expect(
        dispatcher.send(call("ContactCard/get", "b", { accountId: "shared" })),
      ).resolves.toEqual({ echo: "b" });
      expect(callIds(requests)).toEqual([["b"]]);
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
            ({ jmapRequest: request }) => {
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
            async ({ jmapRequest: request }) => {
              seen.push(request);
              return { ...request, using: [...request.using, "urn:first"] };
            },
            ({ jmapRequest: request }) => {
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
          beforeJmapRequest: [({ jmapRequest: request }) => ({ ...request, createdIds: {} })],
          afterJmapResponse: [
            async ({ jmapRequest: request, jmapResponse: response }) => {
              seen.push({ request, response });
              return { ...response, methodResponses: [["Core/echo", { changed: 1 }, "a"]] };
            },
            ({ jmapRequest: request, jmapResponse: response }) => {
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
    const failure = new JsonMetaError("Batch failed");
    const fail = (): never => {
      throw failure;
    };

    it.each<[string, Partial<DispatcherOptions>]>([
      ["the session fails to load", { session: async () => fail() }],
      ["the transport fails", { transport: { send: async () => fail() } }],
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
        { status: "rejected", reason: expect.any(UnknownError) },
        { status: "rejected", reason: expect.any(UnknownError) },
      ]);
      if (results[0].status !== "rejected" || results[1].status !== "rejected") {
        return;
      }
      expect(results[1].reason).toBe(results[0].reason);
    });

    it("sends a later batch normally after a failed one", async () => {
      let attempts = 0;
      const { dispatcher } = setup({
        transport: {
          send: async (request) => {
            attempts++;
            if (attempts === 1) {
              throw failure;
            }
            return echo(request);
          },
        },
      });

      await expect(dispatcher.send(call("Core/echo", "a"))).rejects.toBe(failure);
      await expect(dispatcher.send(call("Core/echo", "b"))).resolves.toEqual({ echo: "b" });
    });

    it("wraps a transport error that isn't a JsonMetaError in a NetworkError", async () => {
      const cause = new TypeError("socket hang up");
      const { dispatcher } = setup({
        transport: {
          send: async () => {
            throw cause;
          },
        },
      });

      const error = await dispatcher.send(call("Core/echo", "a")).catch((error: unknown) => error);

      expect(error).toBeInstanceOf(NetworkError);
      expect(error).toMatchObject({ message: "socket hang up", cause });
    });

    it("maps a transport error after the signal aborts to CancellationError", async () => {
      const controller = new AbortController();
      const { dispatcher } = setup({
        signal: controller.signal,
        transport: {
          send: (_request, { signal }) =>
            new Promise((_resolve, reject) => {
              // As fetch does: reject with a DOMException AbortError
              signal.addEventListener("abort", () => reject(signal.reason));
            }),
        },
      });

      const result = dispatcher.send(call("Core/echo", "a"));
      await new Promise((resolve) => setTimeout(resolve, 0));
      controller.abort();

      const error = await result.catch((error: unknown) => error);
      expect(error).toBeInstanceOf(CancellationError);
      expect(error).toMatchObject({ cause: expect.objectContaining({ name: "AbortError" }) });
    });

    it("rejects with UnknownError when the transport resolves with something that isn't a JMAP Response", async () => {
      const { dispatcher } = setup({
        transport: {
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          send: async () => undefined as never,
        },
      });

      await expect(dispatcher.send(call("Core/echo", "a"))).rejects.toBeInstanceOf(UnknownError);
    });

    it("leaves a hook's own error unwrapped", async () => {
      const cause = new TypeError("hook failed");
      const { dispatcher } = setup({
        hooks: {
          beforeJmapRequest: [
            () => {
              throw cause;
            },
          ],
        },
      });

      await expect(dispatcher.send(call("Core/echo", "a"))).rejects.toBe(cause);
    });
  });

  describe("transport", () => {
    it("passes the session and the client's signal to the transport", async () => {
      const controller = new AbortController();
      const session = makeSession();
      const send = vi.fn<Transport["send"]>(async (request) => echo(request));
      const { dispatcher } = setup({
        transport: { send },
        session: async () => session,
        signal: controller.signal,
      });

      await dispatcher.send(call("Core/echo", "a"));

      expect(send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ using: [core.urn] }), {
        session,
        signal: controller.signal,
      });
    });

    it("sends the request that beforeJmapRequest returns", async () => {
      const send = vi.fn<Transport["send"]>(async (request) => echo(request));
      const { dispatcher } = setup({
        transport: { send },
        hooks: {
          beforeJmapRequest: [({ jmapRequest }) => ({ ...jmapRequest, using: ["urn:test"] })],
        },
      });

      await dispatcher.send(call("Core/echo", "a"));

      expect(send.mock.calls[0]![0].using).toEqual(["urn:test"]);
    });

    it("rejects method calls with CancellationError once the signal aborts", async () => {
      const controller = new AbortController();
      const send = vi.fn<Transport["send"]>(async (request) => echo(request));
      const { dispatcher } = setup({ transport: { send }, signal: controller.signal });

      const waiting = dispatcher.send(call("Core/echo", "a"));
      controller.abort();
      const later = dispatcher.send(call("Core/echo", "b"));

      await expect(waiting).rejects.toBeInstanceOf(CancellationError);
      await expect(later).rejects.toBeInstanceOf(CancellationError);
      expect(send).not.toHaveBeenCalled();
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
        transport: {
          send: async (request) => {
            requests.push(request);
            await release.promise;
            return echo(request);
          },
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
