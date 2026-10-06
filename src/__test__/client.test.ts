// oxlint-disable typescript/no-unsafe-type-assertion
// cspell:words reqheaders badheaders
import { isDeepStrictEqual } from "node:util";

import type {
  BlobUploadResponse,
  Request as JMAPRequest,
  Response as JMAPResponse,
  ProblemDetails,
  Session,
} from "jmap-rfc-types";
import nock, { type Scope } from "nock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { core } from "../capabilities/core.ts";
import * as builtInCapabilities from "../capabilities/index.ts";
import { mail } from "../capabilities/mail.ts";
import { defineCapability } from "../capability.ts";
import { Client } from "../client.ts";
import {
  CapabilityConfigurationError,
  ConfigurationError,
  HttpError,
  JmapError,
  JsonMetaError,
  MethodCallError,
  NetworkError,
  UnknownError,
} from "../errors.ts";
import type { Middleware } from "../internal/types.ts";
import { ref } from "../ref.ts";

// ------ Fixtures ----------------------------------------

const host = "https://example.test";
const bearerToken = "<opaque-token>";
const sessionUrl = `${host}/.well-known/jmap`;
const sessionUrlPath = new URL(sessionUrl).pathname;
const accountId = "<primary-account-id>";
const apiUrl = `${host}/special-jmap-api`;
const apiUrlPath = new URL(apiUrl).pathname;
const uploadUrl = `${host}/upload/{accountId}`;
const downloadUrl = `${host}/download/{accountId}/{blobId}?type={type}&name={name}`;
const sessionState = "<opaque-session-state>";

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
    [core.urn]: {},
    [mail.urn]: {},
    [example.urn]: {},
  },
} satisfies Partial<Session>;

// ------ Mocking Utils -----------------------------------

function mockSession(): Scope {
  return nock(host).get(sessionUrlPath).reply(200, DEFAULT_SESSION);
}

function mockApi(request: JMAPRequest, response: JMAPResponse): Scope {
  return nock(host, {
    reqheaders: {
      authorization: `Bearer ${bearerToken}`,
      accept: "application/json",
      "content-type": "application/json",
    },
  })
    .post(apiUrlPath, (body: unknown) => isDeepStrictEqual(body, request))
    .reply(200, response);
}

// ------ Mocks -------------------------------------------

describe(Client, () => {
  let sessionScope: Scope;
  let client = new Client({
    sessionUrl,
    bearerToken,
    capabilities: [mail],
  });

  beforeEach(() => {
    client = new Client({
      sessionUrl,
      bearerToken,
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
      reqheaders: { authorization: `Bearer ${bearerToken}`, accept: "application/json" },
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
      { bearerToken: "" },
      { bearerToken: "  " },
      { bearerToken: null },
      { sessionUrl: "invalid-url" },
      { capabilities: null },
      { capabilities: "mail" },
      { middleware: "invalid" },
      { middleware: [null] },
    ])("reports invalid options with their original values: %j", (invalidOptions) => {
      const options = { bearerToken, sessionUrl, capabilities: [mail], ...invalidOptions };
      const createClient = () =>
        // @ts-expect-error - Exercise runtime validation of invalid configuration.
        new Client(options);
      expect(createClient).toThrow(ConfigurationError);
      expect(createClient).toThrow(expect.objectContaining({ cause: invalidOptions }));
    });

    it.each([
      "unknown",
      { entities: ["Example"] },
      { urn: "urn:example", entities: "Example" },
      { urn: "urn:example", entities: [42] },
    ])("reports invalid capabilities with available built-ins: %j", (capability) => {
      const createClient = () =>
        new Client({
          bearerToken,
          sessionUrl,
          // @ts-expect-error - Exercise runtime validation of invalid capabilities.
          capabilities: [capability],
        });
      expect(createClient).toThrow(CapabilityConfigurationError);
      expect(createClient).toThrow(
        expect.objectContaining({
          givenCapability: capability,
          availableBuiltIns: Object.keys(builtInCapabilities),
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

    it("delivers a malformed JSON error to every call in its batch", async () => {
      const mailbox = client.api.Mailbox.query({ limit: 1 });
      const email = client.api.Email.query({ limit: 2 });
      const scope = nock(host)
        .post(apiUrlPath)
        .reply(200, "{invalid", { "content-type": "application/json" });
      const results = await Promise.allSettled([mailbox, email]);
      expect(results[0]).toMatchObject({
        status: "rejected",
        reason: expect.any(SyntaxError),
      });
      expect(results[1]).toEqual(results[0]);
      if (results[0]?.status !== "rejected" || results[1]?.status !== "rejected")
        throw new Error("Expected rejected calls");
      expect(results[1].reason).toBe(results[0].reason);
      expect(scope.isDone()).toBe(true);
    });

    it("rejects every pending call with the same error if processing a method response fails", async () => {
      const mailbox = client.api.Mailbox.query({ limit: 1 });
      const email = client.api.Email.query({ limit: 2 });
      const scope = nock(host)
        .post(apiUrlPath)
        .reply(200, {
          methodResponses: [["Mailbox/query", { ids: [] }, mailbox.id], null],
          sessionState,
        });
      const results = await Promise.allSettled([mailbox, email]);
      expect(results).toEqual([
        { status: "rejected", reason: expect.any(TypeError) },
        { status: "rejected", reason: expect.any(TypeError) },
      ]);
      if (results[0]?.status !== "rejected" || results[1]?.status !== "rejected")
        throw new Error("Expected rejected calls");
      expect(results[1].reason).toBe(results[0].reason);
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
            ["Mailbox/query", { accountId, limit: 1 }, mailbox.id],
            ["Email/query", { accountId, limit: 2 }, email.id],
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
  });

  describe("capability names", () => {
    it.each(Object.entries(builtInCapabilities))(
      "resolves %s to its built-in URN",
      async (name, capability) => {
        const warn = vi.fn<typeof console.warn>();
        const namedClient = new Client({
          bearerToken,
          sessionUrl,
          capabilities: [name as keyof typeof builtInCapabilities],
          logger: { ...console, warn },
        });

        await namedClient.session;

        // oxlint-disable vitest/no-conditional-expect
        if (Object.hasOwn(DEFAULT_SESSION.capabilities, capability.urn)) {
          expect(warn).not.toHaveBeenCalled();
        } else {
          expect(warn).toHaveBeenCalledExactlyOnceWith(
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
            new Client({
              bearerToken,
              sessionUrl,
              // @ts-expect-error - Invalid name string
              capabilities: [name],
            }),
        ).toThrow(`Unknown built-in capability: ${name}`);
      },
    );

    it("mixes names and objects in requests without duplicate URNs", async () => {
      const mixedClient = new Client({
        bearerToken,
        sessionUrl,
        capabilities: ["core", "mail", mail, example],
      });
      const query = mixedClient.api.Mailbox.query({ limit: 1 });
      const get = mixedClient.api.Example.get({ value: "hello" });
      const apiScope = mockApi(
        {
          using: [core.urn, mail.urn, example.urn],
          methodCalls: [
            ["Mailbox/query", { accountId, limit: 1 }, query.id],
            ["Example/get", { accountId, value: "hello" }, get.id],
          ],
        },
        {
          methodResponses: [
            ["Mailbox/query", { ids: ["inbox"] }, query.id],
            ["Example/get", { value: "hello" }, get.id],
          ],
          sessionState,
        },
      );

      await expect(query).resolves.toEqual({ ids: ["inbox"] });
      await expect(get).resolves.toEqual({ value: "hello" });
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
          new Client({
            sessionUrl: "invalid-url",
            bearerToken,
            capabilities: [mail],
          }),
      ).toThrow("`sessionUrl` must be a valid URL string or URL instance");
    });

    it("accepts URL instances as session URLs", async () => {
      const client = new Client({
        sessionUrl: new URL(sessionUrl),
        bearerToken,
        capabilities: [mail],
      });
      await expect(client.session).resolves.toEqual(DEFAULT_SESSION);
      expect(sessionScope.isDone()).toBe(true);
    });
  });

  describe("api", () => {
    it("attaches the method call and response data to unrecognized method errors", async () => {
      const query = client.api.Mailbox.query({ limit: 1 });
      const responseData = { detail: "missing error type" };
      const scope = mockApi(
        {
          using: [core.urn, mail.urn],
          methodCalls: [["Mailbox/query", { accountId, limit: 1 }, query.id]],
        },
        { methodResponses: [["error", responseData, query.id]], sessionState },
      );
      await expect(query).rejects.toMatchObject({
        name: "MethodCallError",
        message: "Unknown error in method call",
        methodCall: { method: "Mailbox/query", args: { accountId, limit: 1 }, id: query.id },
        responseData,
      });
      expect(scope.isDone()).toBe(true);
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
              query.id,
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
              query.id,
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

    it("batches same-turn method calls and matches out-of-order responses by ID", async () => {
      const mailboxQuery = client.api.Mailbox.query({ limit: 1 });
      const emailQuery = client.api.Email.query({ limit: 1 });
      const apiScope = mockApi(
        {
          using: [core.urn, mail.urn],
          methodCalls: [
            ["Mailbox/query", { accountId, limit: 1 }, mailboxQuery.id],
            ["Email/query", { accountId, limit: 1 }, emailQuery.id],
          ],
        },
        {
          methodResponses: [
            ["Email/query", { ids: ["email"] }, emailQuery.id],
            ["Mailbox/query", { ids: ["mailbox"] }, mailboxQuery.id],
          ],
          sessionState,
        },
      );

      await expect(mailboxQuery).resolves.toEqual({ ids: ["mailbox"] });
      await expect(emailQuery).resolves.toEqual({ ids: ["email"] });
      expect(sessionScope.isDone()).toBe(true);
      expect(apiScope.isDone()).toBe(true);
    });

    it("turns nested result references into JMAP result-reference arguments", async () => {
      const mailboxQuery = client.api.Mailbox.query({ limit: 1 });
      const emailGet = client.api.Email.get({ ids: ref(mailboxQuery, "/ids") });
      const apiScope = mockApi(
        {
          using: [core.urn, mail.urn],
          methodCalls: [
            ["Mailbox/query", { accountId, limit: 1 }, mailboxQuery.id],
            [
              "Email/get",
              {
                accountId,
                "#ids": { name: "Mailbox/query", resultOf: mailboxQuery.id, path: "/ids" },
              },
              emailGet.id,
            ],
          ],
        },
        {
          methodResponses: [
            ["Mailbox/query", { ids: ["inbox"] }, mailboxQuery.id],
            ["Email/get", { list: [] }, emailGet.id],
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
          methodCalls: [["Mailbox/query", { accountId: "account-2", limit: 1 }, query.id]],
        },
        { methodResponses: [["Mailbox/query", { ids: [] }, query.id]], sessionState },
      );

      await expect(query).resolves.toEqual({ ids: [] });
      expect(sessionScope.isDone()).toBe(true);
      expect(apiScope.isDone()).toBe(true);
    });

    it("translates JMAP method errors into JmapError instances", async () => {
      const query = client.api.Mailbox.query({ limit: 1 });
      const cause: ProblemDetails = {
        type: "invalidArguments",
        detail: "limit must be positive",
      };
      const apiScope = mockApi(
        {
          using: [core.urn, mail.urn],
          methodCalls: [["Mailbox/query", { accountId, limit: 1 }, query.id]],
        },
        { methodResponses: [["error", cause, query.id]], sessionState },
      );

      await expect(query).rejects.toMatchObject({
        name: "JmapError",
        type: cause.type,
        detail: cause.detail,
        cause,
        methodCall: expect.objectContaining({
          method: "Mailbox/query",
          args: { accountId, limit: 1 },
          id: query.id,
        }),
      } satisfies Partial<JmapError>);
      expect(sessionScope.isDone()).toBe(true);
      expect(apiScope.isDone()).toBe(true);
    });

    it("associates each batched method error with its original call", async () => {
      const mailbox = client.api.Mailbox.query({ limit: 1 });
      const email = client.api.Email.query({ limit: 2 });
      const mailboxError = {
        type: "invalidArguments",
        description: "Invalid mailbox filter",
        extra: "mailbox",
      };
      const emailError = { type: "serverFail", extra: "email" };
      const scope = nock(host)
        .post(apiUrlPath)
        .reply(200, {
          methodResponses: [
            ["error", emailError, email.id],
            ["error", mailboxError, mailbox.id],
          ],
          sessionState,
        });
      const results = await Promise.allSettled([mailbox, email]);
      expect(results).toMatchObject([
        {
          status: "rejected",
          reason: {
            name: "JmapError",
            cause: mailboxError,
            methodCall: { id: mailbox.id, method: "Mailbox/query", args: { accountId, limit: 1 } },
          },
        },
        {
          status: "rejected",
          reason: {
            name: "JmapError",
            cause: emailError,
            methodCall: { id: email.id, method: "Email/query", args: { accountId, limit: 2 } },
          },
        },
      ]);
      expect(scope.isDone()).toBe(true);
    });

    it("rejects a response for the wrong method as a method call error", async () => {
      const query = client.api.Mailbox.query({ limit: 1 });
      const scope = nock(host)
        .post(apiUrlPath)
        .reply(200, {
          methodResponses: [["Email/query", { ids: [] }, query.id]],
          sessionState,
        });
      const error = await query.catch((error: unknown) => error);
      expect(error).toBeInstanceOf(MethodCallError);
      expect(error).toMatchObject({
        name: "MethodCallError",
        methodCall: { id: query.id, method: "Mailbox/query" },
        responseData: { ids: [] },
      });
      expect(scope.isDone()).toBe(true);
    });

    it("selects the requested response when an implicit method shares its call ID", async () => {
      const set = client.api.Email.set({ destroy: ["email"] });
      const responseData = { accountId, oldState: "old", newState: "new", destroyed: ["email"] };
      const scope = nock(host)
        .post(apiUrlPath)
        .reply(200, {
          methodResponses: [
            ["Email/set", responseData, set.id],
            [
              "Mailbox/set",
              { accountId, oldState: "old-mailbox", newState: "new-mailbox" },
              set.id,
            ],
          ],
          sessionState,
        });
      await expect(set).resolves.toEqual(responseData);
      expect(scope.isDone()).toBe(true);
    });

    it("rejects method calls missing from a JMAP response", async () => {
      const mailboxQuery = client.api.Mailbox.query({ limit: 1 });
      const emailQuery = client.api.Email.query({ limit: 1 });
      const apiScope = mockApi(
        {
          using: [core.urn, mail.urn],
          methodCalls: [
            ["Mailbox/query", { accountId, limit: 1 }, mailboxQuery.id],
            ["Email/query", { accountId, limit: 1 }, emailQuery.id],
          ],
        },
        { methodResponses: [["Mailbox/query", { ids: [] }, mailboxQuery.id]], sessionState },
      );

      await expect(mailboxQuery).resolves.toEqual({ ids: [] });
      await expect(emailQuery).rejects.toMatchObject({
        name: "MethodCallError",
        message: `No response for method call "${emailQuery.id}"`,
        methodCall: { method: "Email/query", args: { accountId, limit: 1 }, id: emailQuery.id },
        responseData: undefined,
      });
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
      const client = new Client({
        capabilities: [example],
        sessionUrl,
        bearerToken,
      });

      const get = client.api.Example.get({ value: "hello" });

      const apiScope = mockApi(
        {
          using: [core.urn, example.urn],
          methodCalls: [["Example/get", { accountId, value: "hello" }, get.id]],
        },
        {
          methodResponses: [["Example/get", { value: "hello" }, get.id]],
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
      const logger = {
        warn: vi.fn<typeof console.warn>(),
        error: vi.fn<typeof console.error>(),
        info: vi.fn<typeof console.info>(),
        debug: vi.fn<typeof console.debug>(),
      };
      const customClient = new Client({
        capabilities: [example, archive, archive, unused],
        sessionUrl,
        bearerToken,
        logger,
      });
      const get = customClient.api.Example.get({ value: "hello" });
      const archived = customClient.api.Example.archive({ ids: ["one"] });
      const apiScope = mockApi(
        {
          using: [core.urn, example.urn, archive.urn],
          methodCalls: [
            ["Example/get", { accountId, value: "hello" }, get.id],
            ["Example/archive", { accountId, ids: ["one"] }, archived.id],
          ],
        },
        {
          methodResponses: [
            ["Example/get", { value: "hello" }, get.id],
            ["Example/archive", { archived: ["one"] }, archived.id],
          ],
          sessionState,
        },
      );
      await expect(get).resolves.toEqual({ value: "hello" });
      await expect(archived).resolves.toEqual({ archived: ["one"] });
      expect(apiScope.isDone()).toBe(true);
      expect(sessionScope.isDone()).toBe(true);
      expect(logger.warn).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          name: "ConfigurationError",
          message: expect.stringContaining(`${archive.urn}, ${unused.urn}`),
          cause: { invalidCapabilities: [archive.urn, unused.urn] },
        }),
      );
    });

    it("runs custom middleware after the built-in request transformations", async () => {
      const mockMiddleware = vi.fn<Middleware>((_args) => {
        return { foo: true };
      });
      client = new Client({
        middleware: [mockMiddleware],
        sessionUrl,
        bearerToken,
        capabilities: [mail],
      });
      expect(mockMiddleware).not.toHaveBeenCalled();
      const query = client.api.Mailbox.query({ limit: 1 });
      const apiScope = mockApi(
        {
          using: [core.urn, mail.urn],
          methodCalls: [["Mailbox/query", { foo: true }, query.id]],
        },
        { methodResponses: [["Mailbox/query", { ids: [] }, query.id]], sessionState },
      );

      await expect(query).resolves.toEqual({ ids: [] });
      expect(mockMiddleware).toHaveBeenCalledExactlyOnceWith({ accountId, limit: 1 });
      expect(mockMiddleware).toHaveReturnedWith({ foo: true });

      expect(apiScope.isDone()).toBe(true);
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
        await expect(client.blob.upload(body)).resolves.toEqual(responseData);
        expect(fetchMock).toHaveBeenCalledExactlyOnceWith(expect.any(Request));
        const request = fetchMock.mock.calls[0]![0];
        if (!(request instanceof Request)) throw new Error("Expected Request");
        expect(request.method).toBe("POST");
        expect(request.url).toBe(`${host}/upload/${encodeURIComponent(accountId)}`);
        expect(request.headers.get("authorization")).toBe(`Bearer ${bearerToken}`);
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
      await expect(client.blob.upload(body)).rejects.toMatchObject({
        name: "HttpError",
        message: "Blob too large",
        status: 413,
        responseData: { type: "tooLarge", detail: "Blob too large" },
      });
      expect(scope.isDone()).toBe(true);
    });
    it("posts body to correct url", async () => {
      const blob = new Blob([JSON.stringify({ someStuff: "here" })], { type: "application/json" });

      const providedResponse: BlobUploadResponse = {
        accountId,
        blobId: crypto.randomUUID(),
        size: blob.size,
        type: blob.type,
      };

      const scope = nock(host)
        .post(`/upload/${encodeURIComponent(accountId)}`)
        .reply(200, providedResponse);

      const response = await client.blob.upload(blob, { accountId });

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
          .download({ blobId: "blob", type: "text/plain", name: "file" })
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
        client.blob.download({ blobId: "blob", name: "file", type: "text/plain" }),
      ).rejects.toBe(error);
    });

    it("wraps download fetch rejections with the original cause", async () => {
      await client.session;
      const cause = new TypeError("download disconnected");
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(cause));
      await expect(
        client.blob.download({ blobId: "blob", name: "file", type: "text/plain" }),
      ).rejects.toMatchObject({
        name: "NetworkError",
        cause,
        request: expect.objectContaining({
          method: "GET",
          url: `${host}/download/${encodeURIComponent(accountId)}/blob?type=${encodeURIComponent("text/plain")}&name=file`,
        }),
      });
    });
    it("issues get request to correct url", async () => {
      const blobId = crypto.randomUUID();
      const name = "Some $up3r@ special name!";

      const scope = nock(host)
        .get(
          `/download/${encodeURIComponent(accountId)}/${encodeURIComponent(blobId)}?type=${encodeURIComponent("application/json")}&name=${encodeURIComponent(name)}`,
        )
        .reply(200, {
          a: ["very", "special", "blob"],
        });

      const response = await client.blob.download({
        blobId,
        name,
        type: "application/json",
        accountId,
      });

      await expect(response.json()).resolves.toStrictEqual({
        a: ["very", "special", "blob"],
      });

      expect(scope.isDone()).toBe(true);
    });
  });
});
