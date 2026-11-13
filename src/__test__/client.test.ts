// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import { inspect, isDeepStrictEqual } from "node:util";

import nock from "nock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BUILT_IN_CAPABILITIES } from "../built-ins.ts";
import { core } from "../capabilities/core.ts";
import { mail } from "../capabilities/mail.ts";
import { defineCapability } from "../capability.ts";
import { JsonMetaClient } from "../client.ts";
import {
  CapabilityConfigurationError,
  ConfigurationError,
  HttpError,
  JmapError,
  JsonMetaError,
  NetworkError,
  UnknownEntityError,
  UnknownError,
} from "../errors.ts";
import type {
  FileUpload,
  Request as JMAPRequest,
  Response as JMAPResponse,
  ProblemDetails,
  Session,
} from "../rfc-types/core/index.ts";
import type { AfterFetchHook, BeforeFetchHook } from "../types.ts";
import { coreSessionCapabilities } from "./fixtures.ts";

// ------ Fixtures ----------------------------------------

const host = "https://example.test";
const token = "<opaque-token>";
const sessionUrl = `${host}/.well-known/jmap`;
const sessionUrlPath = new URL(sessionUrl).pathname;
const accountId = "<primary-account-id>";
const apiUrl = `${host}/special-jmap-api`;
const apiUrlPath = new URL(apiUrl).pathname;
const uploadUrl = `${host}/upload/{accountId}`;
const downloadUrl = `${host}/download/{accountId}/{blobId}?type={type}&name={name}`;
const sessionState = "<opaque-session-state>";

type UntypedApi = Record<string | symbol, any>;

/** Views the API as untyped, as untyped JavaScript callers would */
function untyped(api: object): UntypedApi {
  return api;
}

const example = defineCapability({
  urn: "urn:example:test",
  entities: ["Example"],
}).withMethods<{
  Example: {
    get: {
      input: { value: string };
      output: { value: string };
    };
  };
}>();

const DEFAULT_SESSION = {
  apiUrl,
  primaryAccounts: {
    [mail.urn]: accountId,
  },
  uploadUrl,
  downloadUrl,
  eventSourceUrl: `${host}/events`,
  capabilities: {
    [core.urn]: coreSessionCapabilities,
    [mail.urn]: {},
    [example.urn]: {},
  },
} satisfies Partial<Session>;

// ------ Mocking Utils -----------------------------------

function mockSession(): nock.Scope {
  return nock(host).get(sessionUrlPath).reply(200, DEFAULT_SESSION);
}

function mockApi(request: JMAPRequest, response: JMAPResponse): nock.Scope {
  return nock(host, {
    reqheaders: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
      "content-type": "application/json",
    },
  })
    .post(apiUrlPath, (body: unknown) => isDeepStrictEqual(body, request))
    .reply(200, response);
}

// ------ Mocks -------------------------------------------

const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

describe(JsonMetaClient, () => {
  let sessionScope: nock.Scope;
  let client = new JsonMetaClient({
    sessionUrl,
    auth: token,
    capabilities: [mail],
  });

  beforeEach(() => {
    client = new JsonMetaClient({
      sessionUrl,
      auth: token,
      capabilities: [mail],
    });
    sessionScope = mockSession();
  });

  afterEach(() => {
    nock.cleanAll();
    vi.unstubAllGlobals();
  });

  it("exposes the public client interface", async () => {
    expect(client).toHaveProperty("api");
    expect(client).toHaveProperty("session");
    expect(client.refreshSession).toBeTypeOf("function");
    const session = await client.session;
    expect(session).toEqual(DEFAULT_SESSION);
  });

  it("requests a JSON session without declaring a request-body content type", async () => {
    nock.cleanAll();
    const scope = nock(host, {
      reqheaders: { authorization: `Bearer ${token}`, accept: "application/json" },
      badheaders: ["content-type"],
    })
      .get(sessionUrlPath)
      .reply(200, DEFAULT_SESSION);
    await expect(client.session).resolves.toEqual(DEFAULT_SESSION);
    expect(scope.isDone()).toBe(true);
  });

  it("is frozen", () => {
    expect(Object.isFrozen(client)).toBe(true);
  });

  describe("configuration errors", () => {
    it.each([
      { auth: "" },
      { auth: "  " },
      { auth: null },
      { sessionUrl: "invalid-url" },
      { capabilities: null },
      { capabilities: "mail" },
    ])("reports invalid options with their original values: %j", (invalidOptions) => {
      const options = {
        auth: token,
        sessionUrl,
        capabilities: [mail],
        ...invalidOptions,
      };
      const createClient = () =>
        // @ts-expect-error - Exercise runtime validation of invalid configuration.
        new JsonMetaClient(options);
      expect(createClient).toThrow(ConfigurationError);
      expect(createClient).toThrow(expect.objectContaining({ cause: invalidOptions }));
    });

    it.each([
      "unknown",
      { entities: ["Example"] },
      { urn: "urn:example", entities: "Example" },
      { urn: "urn:example", entities: [42] },
      { urn: "urn:example", entities: ["Example"], dependsOn: "urn:other" },
      { urn: "urn:example", entities: ["Example"], dependsOn: [42] },
    ])("reports invalid capabilities with available built-ins: %j", (capability) => {
      const createClient = () =>
        new JsonMetaClient({
          auth: token,
          sessionUrl,
          // @ts-expect-error - Exercise runtime validation of invalid capabilities.
          capabilities: [capability],
        });
      expect(createClient).toThrow(CapabilityConfigurationError);
      expect(createClient).toThrow(
        expect.objectContaining({
          givenCapability: capability,
          availableBuiltIns: Object.keys(BUILT_IN_CAPABILITIES),
        }),
      );
    });
  });

  describe("request errors", () => {
    it.each([
      { type: "serverFail", detail: "Try again later", status: 400 },
      "Service unavailable",
      { message: "Service unavailable" },
    ])("preserves HTTP failure context: %j", async (payload) => {
      nock.cleanAll();
      const scope = nock(host).get(sessionUrlPath).reply(503, payload, { "retry-after": "60" });
      const error = await client.session.catch((error: unknown) => error);
      expect(error).toBeInstanceOf(HttpError);
      expect(error).not.toBeInstanceOf(JmapError);
      if (!(error instanceof HttpError)) throw new Error("Expected HttpError");
      expect(error.status).toBe(503);
      expect(error.responseData).toEqual(payload);
      expect(error.request.url).toBe(sessionUrl);
      expect(error.response.headers.get("retry-after")).toBe("60");
      expect(error.response.bodyUsed).toBe(false);
      expect(error.message).toBe(
        typeof payload === "object" && "detail" in payload
          ? payload.detail
          : "HTTP request failed (503)",
      );
      expect(scope.isDone()).toBe(true);
    });

    it.each([
      new JsonMetaError("library failure"),
      new JmapError("server failure", { type: "serverFail" }),
      new UnknownError("unknown failure", { cause: "unexpected payload" }),
      new ConfigurationError("configuration failure"),
      new NetworkError("network failure", { cause: new TypeError("offline"), request: undefined }),
    ])("preserves an existing library error instance: %s", async (error) => {
      vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockRejectedValue(error));
      await expect(client.session).rejects.toBe(error);
    });

    it.each([new TypeError("fetch failed"), "offline"])(
      "wraps fetch rejection %s",
      async (cause) => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(cause));
        await expect(client.session).rejects.toMatchObject({
          name: "NetworkError",
          message: cause instanceof Error ? cause.message : "Error when fetching",
          cause,
          request: expect.any(Request),
        });
      },
    );

    it("wraps invalid JSON responses with their parsing error", async () => {
      nock.cleanAll();
      const scope = nock(host)
        .get(sessionUrlPath)
        .reply(200, "{invalid", { "content-type": "application/json" });
      await expect(client.session).rejects.toBeInstanceOf(SyntaxError);
      expect(scope.isDone()).toBe(true);
    });

    it("retains the HTTP response and parsing cause when an error body has malformed JSON", async () => {
      nock.cleanAll();
      const scope = nock(host)
        .get(sessionUrlPath)
        .reply(502, "{invalid", { "content-type": "application/problem+json" });
      const error = await client.session.catch((error: unknown) => error);
      expect(error).toBeInstanceOf(HttpError);
      expect(error).toMatchObject({
        status: 502,
        responseData: undefined,
        cause: expect.any(SyntaxError),
      });
      if (!(error instanceof HttpError)) throw new Error("Expected HttpError");
      await expect(error.response.text()).resolves.toBe("{invalid");
      expect(scope.isDone()).toBe(true);
    });

    it("preserves an HTTP response when reading its body fails", async () => {
      const cause = new TypeError("Body stream disconnected");
      const response = new Response(
        new ReadableStream({ start: (controller) => controller.error(cause) }),
        {
          status: 503,
        },
      );
      vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(response));
      await expect(client.session).rejects.toMatchObject({
        name: "HttpError",
        status: 503,
        response,
        cause,
      });
    });

    it("classifies a disconnected successful response body as a network failure", async () => {
      const cause = new TypeError("Body stream disconnected");
      const response = new Response(
        new ReadableStream({ start: (controller) => controller.error(cause) }),
      );
      vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(response));
      await expect(client.session).rejects.toMatchObject({
        name: "NetworkError",
        request: expect.objectContaining({ url: sessionUrl }),
        cause,
      });
    });

    it("uses the augmented method call id option", async () => {
      const id = "client-provided-id";
      const query = client.api.Mailbox.query({ limit: 1 }, { id });
      const regularQuery = client.api.Mailbox.query({ limit: 2 });
      expect(regularQuery.$id).not.toBe(id);
      expect(query.$id).toBe(id);
      const scope = nock(host)
        .post(apiUrlPath, {
          using: [core.urn, mail.urn],
          methodCalls: [
            ["Mailbox/query", { accountId, limit: 1 }, id],
            ["Mailbox/query", { accountId, limit: 2 }, regularQuery.$id],
          ],
        })
        .reply(200, {
          methodResponses: [
            ["Mailbox/query", { ids: [] }, id],
            ["Mailbox/query", { ids: ["regular"] }, regularQuery.$id],
          ],
          sessionState,
        });

      await expect(Promise.all([query, regularQuery])).resolves.toEqual([
        { ids: [] },
        { ids: ["regular"] },
      ]);
      expect(scope.isDone()).toBe(true);
    });

    it("retains an undefined request when request construction fails", async () => {
      vi.stubGlobal(
        "Request",
        vi.fn(function () {
          throw new TypeError("Cannot construct request");
        }),
      );
      await expect(client.session).rejects.toMatchObject({
        name: "NetworkError",
        message: "Cannot construct request",
        cause: expect.any(TypeError),
        request: undefined,
      });
    });

    it("rejects all batched method calls with the same HTTP error", async () => {
      const mailbox = client.api.Mailbox.query({ limit: 1 });
      const email = client.api.Email.query({ limit: 2 });
      const scope = nock(host)
        .post(apiUrlPath, {
          using: [core.urn, mail.urn],
          methodCalls: [
            ["Mailbox/query", { accountId, limit: 1 }, mailbox.$id],
            ["Email/query", { accountId, limit: 2 }, email.$id],
          ],
        })
        .reply(503, { type: "serverFail", detail: "API unavailable" });
      const results = await Promise.allSettled([mailbox, email]);
      expect(results[0]).toMatchObject({
        status: "rejected",
        reason: {
          name: "HttpError",
          message: "API unavailable",
          status: 503,
          responseData: { type: "serverFail", detail: "API unavailable" },
        },
      });
      expect(results[1]).toEqual(results[0]);
      if (results[0]?.status !== "rejected" || results[1]?.status !== "rejected")
        throw new Error("Expected rejected calls");
      expect(results[1].reason).toBe(results[0].reason);
      expect(results[0].reason).toBeInstanceOf(HttpError);
      expect(scope.isDone()).toBe(true);
    });

    it("rejects all batched method calls with the same network error", async () => {
      const mailbox = client.api.Mailbox.query({ limit: 1 });
      const email = client.api.Email.query({ limit: 2 });
      const scope = nock(host)
        .post(apiUrlPath, {
          using: [core.urn, mail.urn],
          methodCalls: [
            ["Mailbox/query", { accountId, limit: 1 }, mailbox.$id],
            ["Email/query", { accountId, limit: 2 }, email.$id],
          ],
        })
        .replyWithError("connection reset");
      const results = await Promise.allSettled([mailbox, email]);
      expect(results[0]).toMatchObject({
        status: "rejected",
        reason: {
          name: "NetworkError",
          request: expect.objectContaining({ method: "POST", url: apiUrl }),
        },
      });
      expect(results[1]).toEqual(results[0]);
      if (results[0]?.status !== "rejected" || results[1]?.status !== "rejected")
        throw new Error("Expected rejected calls");
      expect(results[1].reason).toBe(results[0].reason);
      expect(results[0].reason).toBeInstanceOf(NetworkError);
      expect(scope.isDone()).toBe(true);
    });
  });

  describe("capability names", () => {
    it.each(Object.entries(BUILT_IN_CAPABILITIES))(
      "resolves %s to its built-in URN",
      async (name, capability) => {
        const namedClient = new JsonMetaClient({
          auth: token,
          sessionUrl,
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          capabilities: [name as keyof typeof BUILT_IN_CAPABILITIES],
        });

        await namedClient.session;

        // oxlint-disable vitest/no-conditional-expect
        if (Object.hasOwn(DEFAULT_SESSION.capabilities, capability.urn)) {
          expect(warnSpy).not.toHaveBeenCalled();
        } else {
          expect(warnSpy).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({
              message: `json-meta-client was configured with capabilities that are NOT found in the current session: ${capability.urn}`,
            }),
          );
        }
        // oxlint-enable vitest/no-conditional-expect
      },
    );

    it.each(["unknown", "Mail", "toString", "__proto__", "urn:ietf:params:jmap:mail"])(
      "rejects the unknown name %s",
      (name) => {
        expect(
          () =>
            new JsonMetaClient({
              auth: token,
              sessionUrl,
              // @ts-expect-error - Invalid name string
              capabilities: [name],
            }),
        ).toThrow(`Unknown built-in capability: ${name}`);
      },
    );

    it("mixes names and objects in requests without duplicate URNs", async () => {
      const mixedClient = new JsonMetaClient({
        auth: token,
        sessionUrl,
        capabilities: ["core", "mail", mail, example],
      });
      const query = mixedClient.api.Mailbox.query({ limit: 1 });
      const get = mixedClient.api.Example.get({ value: "hello" });
      const apiScope = mockApi(
        {
          using: [core.urn, mail.urn, example.urn],
          methodCalls: [
            ["Mailbox/query", { accountId, limit: 1 }, query.$id],
            ["Example/get", { accountId, value: "hello" }, get.$id],
          ],
        },
        {
          methodResponses: [
            ["Mailbox/query", { ids: ["inbox"] }, query.$id],
            ["Example/get", { value: "hello" }, get.$id],
          ],
          sessionState,
        },
      );

      await expect(query).resolves.toEqual({ ids: ["inbox"] });
      await expect(get).resolves.toEqual({ value: "hello" });
      expect(apiScope.isDone()).toBe(true);
    });

    it("adds the URNs a capability depends on to its calls", async () => {
      const mdnClient = new JsonMetaClient({
        auth: token,
        sessionUrl,
        capabilities: ["mdn"],
      });
      const parsed = mdnClient.api.MDN.parse({ blobIds: ["blob"] });
      const apiScope = mockApi(
        {
          using: [core.urn, "urn:ietf:params:jmap:mdn", mail.urn],
          methodCalls: [["MDN/parse", { accountId, blobIds: ["blob"] }, parsed.$id]],
        },
        {
          methodResponses: [["MDN/parse", { notFound: ["blob"] }, parsed.$id]],
          sessionState,
        },
      );

      await expect(parsed).resolves.toEqual({ notFound: ["blob"] });
      expect(apiScope.isDone()).toBe(true);
    });

    it("adds the S/MIME verification URN to Email calls only", async () => {
      const smimeClient = new JsonMetaClient({
        auth: token,
        sessionUrl,
        capabilities: ["mail", "smime"],
      });
      const email = smimeClient.api.Email.get({ ids: ["e1"], properties: ["smimeStatus"] });
      const mailbox = smimeClient.api.Mailbox.get({ ids: ["inbox"] });
      const apiScope = mockApi(
        {
          using: [core.urn, mail.urn, "urn:ietf:params:jmap:smimeverify"],
          methodCalls: [
            ["Email/get", { accountId, ids: ["e1"], properties: ["smimeStatus"] }, email.$id],
            ["Mailbox/get", { accountId, ids: ["inbox"] }, mailbox.$id],
          ],
        },
        {
          methodResponses: [
            ["Email/get", { list: [{ id: "e1", smimeStatus: "signed" }] }, email.$id],
            ["Mailbox/get", { list: [] }, mailbox.$id],
          ],
          sessionState,
        },
      );

      await expect(email).resolves.toEqual({ list: [{ id: "e1", smimeStatus: "signed" }] });
      await expect(mailbox).resolves.toEqual({ list: [] });
      expect(apiScope.isDone()).toBe(true);
    });
  });

  describe("session", () => {
    it("fetches lazily and memoizes the pending promise", async () => {
      expect(sessionScope.isDone()).toBe(false);
      const session = client.session;
      expect(session).toBeInstanceOf(Promise);
      expect(client.session).toBe(session);
      await expect(session).resolves.toEqual(DEFAULT_SESSION);
      expect(sessionScope.isDone()).toBe(true);
    });

    it("throws invalid session URLs", () => {
      expect(
        () =>
          new JsonMetaClient({
            sessionUrl: "invalid-url",
            auth: token,
            capabilities: [mail],
          }),
      ).toThrow("`sessionUrl` must be a valid URL string or URL instance");
    });

    it("accepts URL instances as session URLs", async () => {
      const client = new JsonMetaClient({
        sessionUrl: new URL(sessionUrl),
        auth: token,
        capabilities: [mail],
      });
      await expect(client.session).resolves.toEqual(DEFAULT_SESSION);
      expect(sessionScope.isDone()).toBe(true);
    });
  });

  describe("api", () => {
    describe("unknown entities", () => {
      it("rejects calls on entities no capability owns without sending them", async () => {
        const api = untyped(client.api);
        const call = api.Foo.bar({});
        expect(call.$method).toBe("Foo/bar");
        expect(call.$args).toEqual({});
        expect(call.$id).toEqual(expect.stringMatching(/^Foo\/bar::/));
        await expect(call).rejects.toBeInstanceOf(UnknownEntityError);
        await expect(call).rejects.toBeInstanceOf(JsonMetaError);
        await expect(call).rejects.toMatchObject({
          entity: "Foo",
          method: "bar",
          message: expect.stringMatching(/Foo\/bar.*defineCapability/s),
        });
      });

      it("leaves other calls in the batch unaffected", async () => {
        const api = untyped(client.api);
        const unknown = api.Foo.bar({});
        const query = client.api.Mailbox.query({ limit: 1 });
        const scope = mockApi(
          {
            using: [core.urn, mail.urn],
            methodCalls: [["Mailbox/query", { accountId, limit: 1 }, query.$id]],
          },
          { methodResponses: [["Mailbox/query", { ids: [] }, query.$id]], sessionState },
        );
        await expect(unknown).rejects.toBeInstanceOf(UnknownEntityError);
        await expect(query).resolves.toEqual({ ids: [] });
        expect(scope.isDone()).toBe(true);
      });

      it.each([
        ["Core", "echo", { hello: "world" }],
        ["Blob", "copy", {}],
        ["PushSubscription", "get", {}],
        ["PushSubscription", "set", {}],
      ])("allows %s.%s without listing core", async (entity, method, args) => {
        const api = untyped(client.api);
        const call = api[entity][method](args);
        const scope = mockApi(
          {
            using: [core.urn],
            methodCalls: [[`${entity}/${method}`, { accountId, ...args }, call.$id]],
          },
          { methodResponses: [[`${entity}/${method}`, {}, call.$id]], sessionState },
        );
        await expect(call).resolves.toEqual({});
        expect(scope.isDone()).toBe(true);
      });

      it("allows entities from untyped custom capabilities", async () => {
        const widget = defineCapability({ urn: "urn:example:untyped", entities: ["Widget"] });
        const custom = new JsonMetaClient({ sessionUrl, auth: token, capabilities: [widget] });
        const call = untyped(custom.api).Widget.get({});
        const scope = mockApi(
          {
            using: [core.urn, widget.urn],
            methodCalls: [["Widget/get", { accountId }, call.$id]],
          },
          { methodResponses: [["Widget/get", {}, call.$id]], sessionState },
        );
        await expect(call).resolves.toEqual({});
        expect(scope.isDone()).toBe(true);
      });

      it("does not throw when reading non-call properties", () => {
        const api = untyped(client.api);
        expect(api.then).toBeUndefined();
        expect(api[Symbol.iterator]).toBeUndefined();
        expect(() => String(Object.keys(api.Foo))).not.toThrow();
        expect(() => inspect(api.Foo)).not.toThrow();
        expect(api.Foo.then).toBeUndefined();
        expect(api.Foo[Symbol.toPrimitive]).toBeUndefined();
      });
    });

    it("sends a JMAP request with required capabilities and injected account ID", async () => {
      const query = client.api.Mailbox.query({
        limit: 3,
        filter: {
          hasAnyRole: true,
        },
      });

      const apiScope = mockApi(
        {
          using: [core.urn, mail.urn],
          methodCalls: [
            [
              "Mailbox/query",
              {
                accountId,
                limit: 3,
                filter: { hasAnyRole: true },
              },
              query.$id,
            ],
          ],
        },
        {
          methodResponses: [
            [
              "Mailbox/query",
              {
                ids: ["some-id", "another-id"],
              },
              query.$id,
            ],
          ],
          sessionState,
        },
      );

      await expect(query).resolves.toEqual({
        ids: ["some-id", "another-id"],
      });

      expect(sessionScope.isDone()).toBe(true);
      expect(apiScope.isDone()).toBe(true);
    });

    it("turns nested result references into JMAP result-reference arguments", async () => {
      const mailboxQuery = client.api.Mailbox.query({ limit: 1 });
      const emailGet = client.api.Email.get({ ids: mailboxQuery.resultRef("/ids") });
      const apiScope = mockApi(
        {
          using: [core.urn, mail.urn],
          methodCalls: [
            ["Mailbox/query", { accountId, limit: 1 }, mailboxQuery.$id],
            [
              "Email/get",
              {
                accountId,
                "#ids": { name: "Mailbox/query", resultOf: mailboxQuery.$id, path: "/ids" },
              },
              emailGet.$id,
            ],
          ],
        },
        {
          methodResponses: [
            ["Mailbox/query", { ids: ["inbox"] }, mailboxQuery.$id],
            ["Email/get", { list: [] }, emailGet.$id],
          ],
          sessionState,
        },
      );

      await expect(emailGet).resolves.toEqual({ list: [] });
      expect(sessionScope.isDone()).toBe(true);
      expect(apiScope.isDone()).toBe(true);
    });

    it("preserves an explicitly supplied account ID", async () => {
      const query = client.api.Mailbox.query({ accountId: "account-2", limit: 1 });
      const apiScope = mockApi(
        {
          using: [core.urn, mail.urn],
          methodCalls: [["Mailbox/query", { accountId: "account-2", limit: 1 }, query.$id]],
        },
        { methodResponses: [["Mailbox/query", { ids: [] }, query.$id]], sessionState },
      );

      await expect(query).resolves.toEqual({ ids: [] });
      expect(sessionScope.isDone()).toBe(true);
      expect(apiScope.isDone()).toBe(true);
    });

    it("propagates HTTP problem details and the cached session error to method calls", async () => {
      nock.cleanAll();
      const sessionFailure: ProblemDetails = { type: "serverFail" };
      const failedSessionScope = nock(host).get(sessionUrlPath).reply(500, sessionFailure);
      const rejectedError = {
        name: "HttpError",
        message: "HTTP request failed (500)",
        status: 500,
        responseData: sessionFailure,
      };
      const sessionError = await client.session.catch((error: unknown) => error);
      expect(sessionError).toBeInstanceOf(HttpError);
      expect(sessionError).toMatchObject(rejectedError);
      expect(failedSessionScope.isDone()).toBe(true);
      const query = client.api.Mailbox.query({ limit: 1 });
      await expect(query).rejects.toBe(sessionError);
    });

    it("refreshes the session while the initial session access stays cached", async () => {
      nock.cleanAll();
      const refreshedSession = {
        ...DEFAULT_SESSION,
        state: "<new-state>",
      } satisfies Partial<Session>;

      const scope = nock(host)
        .get(sessionUrlPath)
        .reply(200, DEFAULT_SESSION)
        .get(sessionUrlPath)
        .reply(200, refreshedSession);

      const initialSession = client.session;

      await expect(initialSession).resolves.toEqual(DEFAULT_SESSION);
      expect(client.session).toBe(initialSession);

      const refreshedPromise = client.refreshSession();
      expect(refreshedPromise).not.toBe(initialSession);

      await expect(refreshedPromise).resolves.toEqual(refreshedSession);
      expect(client.session).toBe(refreshedPromise);
      expect(scope.isDone()).toBe(true);
    });

    it("adds custom capability URNs to requests", async () => {
      const client = new JsonMetaClient({
        capabilities: [example],
        sessionUrl,
        auth: token,
      });

      const get = client.api.Example.get({ value: "hello" });

      const apiScope = mockApi(
        {
          using: [core.urn, example.urn],
          methodCalls: [["Example/get", { accountId, value: "hello" }, get.$id]],
        },
        {
          methodResponses: [["Example/get", { value: "hello" }, get.$id]],
          sessionState,
        },
      );

      await expect(get).resolves.toEqual({ value: "hello" });
      expect(apiScope.isDone()).toBe(true);
    });

    it("merges shared entities and includes every provider URN without duplicates", async () => {
      const archive = defineCapability({
        urn: "urn:example:archive",
        entities: ["Example"],
      }).withMethods<{
        Example: {
          archive: { input: { ids: string[] }; output: { archived: string[] } };
        };
      }>();
      const unused = defineCapability({ urn: "urn:example:unused", entities: ["Unused"] });
      const customClient = new JsonMetaClient({
        capabilities: [example, archive, archive, unused],
        sessionUrl,
        auth: token,
      });
      const get = customClient.api.Example.get({ value: "hello" });
      const archived = customClient.api.Example.archive({ ids: ["one"] });
      const apiScope = mockApi(
        {
          using: [core.urn, example.urn, archive.urn],
          methodCalls: [
            ["Example/get", { accountId, value: "hello" }, get.$id],
            ["Example/archive", { accountId, ids: ["one"] }, archived.$id],
          ],
        },
        {
          methodResponses: [
            ["Example/get", { value: "hello" }, get.$id],
            ["Example/archive", { archived: ["one"] }, archived.$id],
          ],
          sessionState,
        },
      );
      await expect(get).resolves.toEqual({ value: "hello" });
      await expect(archived).resolves.toEqual({ archived: ["one"] });
      expect(apiScope.isDone()).toBe(true);
      expect(sessionScope.isDone()).toBe(true);
      expect(warnSpy).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          name: "ConfigurationError",
          message: expect.stringContaining(`${archive.urn}, ${unused.urn}`),
          cause: { invalidCapabilities: [archive.urn, unused.urn] },
        }),
      );
    });
  });

  describe("blob.upload", () => {
    it.each(["image/png", "text/plain", "application/json"])(
      "uploads a Blob using its %s media type and original bytes",
      async (type) => {
        await client.session;
        const bytes = new Uint8Array([0, 128, 255, 10]);
        const body = new Blob([bytes], { type });
        const responseData = { accountId, blobId: "blob", size: bytes.length, type };
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
          new Response(JSON.stringify(responseData), {
            headers: { "content-type": "application/json" },
          }),
        );
        vi.stubGlobal("fetch", fetchMock);
        await expect(client.blob.upload(body, { accountId })).resolves.toEqual(responseData);
        expect(fetchMock).toHaveBeenCalledExactlyOnceWith(expect.any(Request));
        const request = fetchMock.mock.calls[0]![0];
        if (!(request instanceof Request)) throw new Error("Expected Request");
        expect(request.method).toBe("POST");
        expect(request.url).toBe(`${host}/upload/${encodeURIComponent(accountId)}`);
        expect(request.headers.get("authorization")).toBe(`Bearer ${token}`);
        expect(request.headers.get("accept")).toBe("application/json");
        expect(request.headers.get("content-type")).toBe(type);
        expect(new Uint8Array(await request.arrayBuffer())).toEqual(bytes);
      },
    );

    it("propagates upload failures as HTTP errors", async () => {
      const body = new Blob(["upload"]);
      const scope = nock(host)
        .post(`/upload/${encodeURIComponent(accountId)}`)
        .reply(413, { type: "tooLarge", detail: "Blob too large" });
      await expect(client.blob.upload(body, { accountId })).rejects.toMatchObject({
        name: "HttpError",
        message: "Blob too large",
        status: 413,
        responseData: { type: "tooLarge", detail: "Blob too large" },
      });
      expect(scope.isDone()).toBe(true);
    });
    it("posts body to the given account's upload url, not the mail primary's", async () => {
      const otherAccountId = "<other-account-id>";
      const blob = new Blob([JSON.stringify({ someStuff: "here" })], { type: "application/json" });

      const providedResponse: FileUpload.Result = {
        accountId: otherAccountId,
        blobId: crypto.randomUUID(),
        size: blob.size,
        type: blob.type,
      };

      const scope = nock(host)
        .post(`/upload/${encodeURIComponent(otherAccountId)}`)
        .reply(200, providedResponse);

      const response = await client.blob.upload(blob, { accountId: otherAccountId });

      expect(response).toStrictEqual(providedResponse);

      expect(scope.isDone()).toBe(true);
    });
  });

  describe("blob.download", () => {
    it.each([{ type: "notFound" }, "Blob not found"])(
      "preserves download HTTP failures: %j",
      async (payload) => {
        const scope = nock(host)
          .get(`/download/${encodeURIComponent(accountId)}/blob`)
          .query({ type: "text/plain", name: "file" })
          .reply(404, payload);
        const error = await client.blob
          .download({ accountId, blobId: "blob", type: "text/plain", name: "file" })
          .catch((error: unknown) => error);
        expect(error).toBeInstanceOf(HttpError);
        if (!(error instanceof HttpError)) throw new Error("Expected HttpError");
        expect(error.status).toBe(404);
        expect(error.message).toBe("HTTP request failed (404)");
        expect(error.responseData).toEqual(payload);
        expect(error.request.method).toBe("GET");
        expect(scope.isDone()).toBe(true);
      },
    );

    it.each([
      new JsonMetaError("library failure"),
      new JmapError("server failure", { type: "serverFail" }),
      new UnknownError("unknown failure", { cause: "unexpected payload" }),
      new ConfigurationError("configuration failure"),
      new NetworkError("network failure", { cause: new TypeError("offline"), request: undefined }),
    ])("preserves an existing library error instance: %s", async (error) => {
      await client.session;
      vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockRejectedValue(error));
      await expect(
        client.blob.download({ accountId, blobId: "blob", name: "file", type: "text/plain" }),
      ).rejects.toBe(error);
    });

    it("wraps download fetch rejections with the original cause", async () => {
      await client.session;
      const cause = new TypeError("download disconnected");
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(cause));
      await expect(
        client.blob.download({ accountId, blobId: "blob", name: "file", type: "text/plain" }),
      ).rejects.toMatchObject({
        name: "NetworkError",
        cause,
        request: expect.objectContaining({
          method: "GET",
          url: `${host}/download/${encodeURIComponent(accountId)}/blob?type=${encodeURIComponent("text/plain")}&name=file`,
        }),
      });
    });
    it("issues get request to the given account's download url, not the mail primary's", async () => {
      const otherAccountId = "<other-account-id>";
      const blobId = crypto.randomUUID();
      const name = "Some $up3r@ special name!";

      const scope = nock(host)
        .get(
          `/download/${encodeURIComponent(otherAccountId)}/${encodeURIComponent(blobId)}?type=${encodeURIComponent("application/json")}&name=${encodeURIComponent(name)}`,
        )
        .reply(200, {
          a: ["very", "special", "blob"],
        });

      const response = await client.blob.download({
        blobId,
        name,
        type: "application/json",
        accountId: otherAccountId,
      });

      await expect(response.json()).resolves.toStrictEqual({
        a: ["very", "special", "blob"],
      });

      expect(scope.isDone()).toBe(true);
    });
  });

  describe("hooks.beforeFetch", () => {
    it("runs hooks in order and uses each returned request", async () => {
      nock.cleanAll();
      const scope = nock(host, {
        reqheaders: {
          "x-first-hook": "first",
          "x-second-hook": "second",
        },
      })
        .get(sessionUrlPath)
        .reply(200, DEFAULT_SESSION);
      const firstHook = vi.fn<BeforeFetchHook>(async ({ request }) => {
        const headers = new Headers(request.headers);
        headers.set("x-first-hook", "first");
        await Promise.resolve();
        return new Request(request, { headers });
      });
      const secondHook = vi.fn<BeforeFetchHook>(({ request }) => {
        const headers = new Headers(request.headers);
        headers.set("x-second-hook", "second");
        return new Request(request, { headers });
      });
      client = new JsonMetaClient({
        sessionUrl,
        auth: token,
        capabilities: [mail],
        hooks: {
          beforeFetch: [firstHook, secondHook],
        },
      });

      await expect(client.session).resolves.toEqual(DEFAULT_SESSION);
      expect(firstHook).toHaveBeenCalledBefore(secondHook);
      expect(secondHook).toHaveBeenCalledAfter(firstHook);
      expect(scope.isDone()).toBe(true);
    });
  });

  describe("hooks.afterFetch", () => {
    it("runs hooks in order and uses each returned response", async () => {
      nock.cleanAll();
      const scope = mockSession();
      const firstHook = vi.fn<AfterFetchHook>(async ({ response }) => {
        const headers = new Headers(response.headers);
        headers.set("x-first-hook", "first");
        await Promise.resolve();
        return new Response(response.body, { status: response.status, headers });
      });
      const secondHook = vi.fn<AfterFetchHook>(({ response }) => {
        expect(response.headers.get("x-first-hook")).toBe("first");
        const headers = new Headers(response.headers);
        headers.set("x-second-hook", "second");
        return new Response(response.body, { status: response.status, headers });
      });
      client = new JsonMetaClient({
        sessionUrl,
        auth: token,
        capabilities: [mail],
        hooks: {
          afterFetch: [firstHook, secondHook],
        },
      });

      await expect(client.session).resolves.toEqual(DEFAULT_SESSION);
      expect(firstHook).toHaveBeenCalledBefore(secondHook);
      expect(secondHook).toHaveBeenCalledAfter(firstHook);
      expect(scope.isDone()).toBe(true);
    });
  });
});
