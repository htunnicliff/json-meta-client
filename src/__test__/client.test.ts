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
} from "../errors/index.ts";
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

const primaryAccounts = {
  ...Object.fromEntries(Object.values(BUILT_IN_CAPABILITIES).map(({ urn }) => [urn, accountId])),
  [example.urn]: accountId,
  "urn:example:untyped": accountId,
  "urn:example:archive": accountId,
};

/** Accounts by ID, each listing the given capability URNs */
function accountsWith(urnsByAccountId: Record<string, string[]>): Session["accounts"] {
  return Object.fromEntries(
    Object.entries(urnsByAccountId).map(([id, urns]) => [
      id,
      {
        name: id,
        isPersonal: true,
        isReadOnly: false,
        accountCapabilities: Object.fromEntries(urns.map((urn) => [urn, {}])),
      },
    ]),
  );
}

const capabilities = {
  [core.urn]: coreSessionCapabilities,
  [mail.urn]: {},
  [example.urn]: {},
};

const DEFAULT_SESSION = {
  apiUrl,
  accounts: accountsWith({ [accountId]: Object.keys(capabilities) }),
  primaryAccounts,
  uploadUrl,
  downloadUrl,
  eventSourceUrl: `${host}/events`,
  capabilities,
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

/**
 * Replaces the mocked session with one that lists the given primary accounts
 * and, when given, the accounts that list each capability URN
 */
function mockSessionWith(
  primaryAccounts: Record<string, string>,
  urnsByAccountId?: Record<string, string[]>,
): void {
  nock.cleanAll();
  nock(host)
    .get(sessionUrlPath)
    .reply(200, {
      ...DEFAULT_SESSION,
      primaryAccounts,
      ...(urnsByAccountId ? { accounts: accountsWith(urnsByAccountId) } : {}),
    });
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

  it.each(["client.api", "client.isolated"])(
    "uses generated method call IDs and explicit overrides through %s",
    async (entryPoint) => {
      const generateMethodCallId = vi.fn<(method: string) => string>(
        (method) => `${method}::generated`,
      );
      const configuredClient = new JsonMetaClient({
        sessionUrl,
        auth: token,
        capabilities: [mail],
        generateMethodCallId,
      });
      const queryId = "Email/query::generated";
      const apiScope = mockApi(
        {
          using: [core.urn, mail.urn],
          methodCalls: [
            ["Email/query", { accountId, limit: 1 }, queryId],
            [
              "Email/get",
              { accountId, "#ids": { name: "Email/query", resultOf: queryId, path: "/ids" } },
              "explicit",
            ],
          ],
        },
        {
          methodResponses: [
            ["Email/query", { ids: ["email"] }, queryId],
            ["Email/get", { list: [{ id: "email" }] }, "explicit"],
          ],
          sessionState,
        },
      );

      async function callMethods(api: typeof configuredClient.api) {
        const query = api.Email.query({ limit: 1 });
        const get = api.Email.get({ ids: query.resultRef("/ids") }, { id: "explicit" });
        expect(query.$id).toBe(queryId);
        expect(get.$id).toBe("explicit");
        await expect(Promise.all([query, get])).resolves.toEqual([
          { ids: ["email"] },
          { list: [{ id: "email" }] },
        ]);
      }

      await (entryPoint === "client.api"
        ? callMethods(configuredClient.api)
        : configuredClient.isolated(callMethods));
      expect(generateMethodCallId.mock.calls).toEqual([["Email/query"]]);
      expect(apiScope.isDone()).toBe(true);
    },
  );

  it("rejects a non-string generated ID before sending the method call", () => {
    const configuredClient = new JsonMetaClient({
      sessionUrl,
      auth: token,
      capabilities: [mail],
      // @ts-expect-error - Exercise an invalid generator from JavaScript.
      generateMethodCallId: () => 1,
    });

    expect(() => configuredClient.api.Email.query({ limit: 1 })).toThrow(
      new TypeError("Method call IDs must be strings"),
    );
    expect(sessionScope.isDone()).toBe(false);
  });

  describe("configuration errors", () => {
    it.each([
      { auth: "" },
      { auth: "  " },
      { auth: null },
      { sessionUrl: "invalid-url" },
      { capabilities: null },
      { capabilities: "mail" },
      { onWarning: "warn" },
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
      { urn: "urn:example", entities: ["Example"], defaultAccount: "primary" },
      { urn: "urn:example", entities: ["Example"], defaultAccount: { "*": "mail" } },
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

    it("requires mail alongside smime", () => {
      expect(
        () => new JsonMetaClient({ auth: token, sessionUrl, capabilities: ["smime"] }),
      ).toThrow(
        expect.objectContaining({
          name: "CapabilityConfigurationError",
          message: "The `smime` capability requires `mail`",
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
      if (!(error instanceof HttpError)) {
        throw new Error("Expected HttpError");
      }
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
      if (!(error instanceof HttpError)) {
        throw new Error("Expected HttpError");
      }
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
      expect(regularQuery.$id).toMatch(/^Mailbox\/query::[a-f0-9]{8}$/);
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
      if (results[0]?.status !== "rejected" || results[1]?.status !== "rejected") {
        throw new Error("Expected rejected calls");
      }
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
      if (results[0]?.status !== "rejected" || results[1]?.status !== "rejected") {
        throw new Error("Expected rejected calls");
      }
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
          // `smime` requires `mail`, which the session already advertises.
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          capabilities: [name as keyof typeof BUILT_IN_CAPABILITIES, "mail"],
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

    it("adds the S/MIME verification URN to SearchSnippet calls", async () => {
      const smimeClient = new JsonMetaClient({
        auth: token,
        sessionUrl,
        capabilities: ["mail", "smime"],
      });
      const snippets = smimeClient.api.SearchSnippet.get({
        emailIds: ["e1"],
        filter: { hasSmime: true },
      });
      const apiScope = mockApi(
        {
          using: [core.urn, mail.urn, "urn:ietf:params:jmap:smimeverify"],
          methodCalls: [
            [
              "SearchSnippet/get",
              { accountId, emailIds: ["e1"], filter: { hasSmime: true } },
              snippets.$id,
            ],
          ],
        },
        {
          methodResponses: [["SearchSnippet/get", { list: [] }, snippets.$id]],
          sessionState,
        },
      );

      await expect(snippets).resolves.toEqual({ list: [] });
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

    it("does not warn about capabilities that only an account advertises", async () => {
      nock.cleanAll();
      const { [example.urn]: _, ...capabilities } = DEFAULT_SESSION.capabilities;
      const scope = nock(host)
        .get(sessionUrlPath)
        .reply(200, {
          ...DEFAULT_SESSION,
          capabilities,
          accounts: {
            [accountId]: {
              name: "user@example.test",
              isPersonal: true,
              isReadOnly: false,
              accountCapabilities: { [mail.urn]: {}, [example.urn]: {} },
            },
          },
        });
      const customClient = new JsonMetaClient({
        sessionUrl,
        auth: token,
        capabilities: [mail, example],
      });

      await customClient.session;

      expect(scope.isDone()).toBe(true);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("passes unavailable capabilities to onWarning instead of the console", async () => {
      const onWarning = vi.fn<(warning: JsonMetaError) => void>();
      const customClient = new JsonMetaClient({
        sessionUrl,
        auth: token,
        capabilities: [mail, "sieve"],
        onWarning,
      });

      await customClient.session;
      mockSession();
      await customClient.refreshSession();

      // Only the first session load is checked
      expect(onWarning).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          name: "ConfigurationError",
          cause: { invalidCapabilities: [BUILT_IN_CAPABILITIES.sieve.urn] },
        }),
      );
      expect(onWarning.mock.calls[0]![0]).toBeInstanceOf(ConfigurationError);
      expect(warnSpy).not.toHaveBeenCalled();
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
        ["Blob", "copy", { accountId: "destination", fromAccountId: accountId, blobIds: [] }],
        ["PushSubscription", "get", {}],
        ["PushSubscription", "set", {}],
      ])("allows %s.%s without listing core", async (entity, method, args) => {
        const api = untyped(client.api);
        const call = api[entity][method](args);
        const scope = mockApi(
          {
            using: [core.urn],
            methodCalls: [[`${entity}/${method}`, args, call.$id]],
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

    it("sends empty arguments with the default account ID when they are left out", async () => {
      const get = client.api.Mailbox.get();

      const apiScope = mockApi(
        {
          using: [core.urn, mail.urn],
          methodCalls: [["Mailbox/get", { accountId }, get.$id]],
        },
        {
          methodResponses: [["Mailbox/get", { list: [], notFound: [] }, get.$id]],
          sessionState,
        },
      );

      await expect(get).resolves.toEqual({ list: [], notFound: [] });
      expect(get.$args).toEqual({ accountId });
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

    it.each([
      ["Blob", "upload", "blob", ["urn:ietf:params:jmap:blob"], { create: {} }],
      ["Email", "copy", "mail", [mail.urn], { fromAccountId: "account-2", create: {} }],
      [
        "ContactCard",
        "copy",
        "contacts",
        ["urn:ietf:params:jmap:contacts"],
        { fromAccountId: "account-2", create: {} },
      ],
    ] as const)(
      "gives %s/%s a default accountId",
      async (entity, method, capability, urns, args) => {
        const otherClient = new JsonMetaClient({
          sessionUrl,
          auth: token,
          capabilities: [capability],
        });
        const call = untyped(otherClient.api)[entity][method](args);
        const name = `${entity}/${method}`;
        const apiScope = mockApi(
          { using: [core.urn, ...urns], methodCalls: [[name, { accountId, ...args }, call.$id]] },
          { methodResponses: [[name, {}, call.$id]], sessionState },
        );

        await expect(call).resolves.toEqual({});
        expect(apiScope.isDone()).toBe(true);
      },
    );

    it("never gives Blob/copy a default accountId", async () => {
      const args = { fromAccountId: "account-2", blobIds: ["blob"] };
      const copy = untyped(client.api).Blob.copy(args);
      const apiScope = mockApi(
        { using: [core.urn], methodCalls: [["Blob/copy", args, copy.$id]] },
        { methodResponses: [["Blob/copy", {}, copy.$id]], sessionState },
      );

      await expect(copy).resolves.toEqual({});
      expect(apiScope.isDone()).toBe(true);
    });

    describe("default accountId", () => {
      const contactsUrn = "urn:ietf:params:jmap:contacts";
      const mdnUrn = "urn:ietf:params:jmap:mdn";
      const smimeUrn = "urn:ietf:params:jmap:smimeverify";

      it("comes from the primary account of the capability that owns the call", async () => {
        mockSessionWith({ [mail.urn]: "mail-account", [contactsUrn]: "contacts-account" });
        const multiClient = new JsonMetaClient({
          sessionUrl,
          auth: token,
          capabilities: ["mail", "contacts"],
        });
        const cards = multiClient.api.ContactCard.get({ ids: ["c1"] });
        const emails = multiClient.api.Email.get({ ids: ["e1"] });
        const apiScope = mockApi(
          {
            using: [core.urn, contactsUrn, mail.urn],
            methodCalls: [
              ["ContactCard/get", { accountId: "contacts-account", ids: ["c1"] }, cards.$id],
              ["Email/get", { accountId: "mail-account", ids: ["e1"] }, emails.$id],
            ],
          },
          {
            methodResponses: [
              ["ContactCard/get", { list: [] }, cards.$id],
              ["Email/get", { list: [] }, emails.$id],
            ],
            sessionState,
          },
        );

        await expect(cards).resolves.toEqual({ list: [] });
        await expect(emails).resolves.toEqual({ list: [] });
        expect(apiScope.isDone()).toBe(true);
      });

      it("goes to the MDN primary account when it differs from the mail primary", async () => {
        mockSessionWith({ [mail.urn]: "mail-account", [mdnUrn]: "mdn-account" });
        const mdnClient = new JsonMetaClient({
          sessionUrl,
          auth: token,
          capabilities: ["mail", "mdn"],
        });
        const parsed = mdnClient.api.MDN.parse({ blobIds: ["blob"] });
        const emails = mdnClient.api.Email.get({ ids: ["e1"] });
        const apiScope = mockApi(
          {
            using: [core.urn, mdnUrn, mail.urn],
            methodCalls: [
              ["MDN/parse", { accountId: "mdn-account", blobIds: ["blob"] }, parsed.$id],
              ["Email/get", { accountId: "mail-account", ids: ["e1"] }, emails.$id],
            ],
          },
          {
            methodResponses: [
              ["MDN/parse", { notFound: ["blob"] }, parsed.$id],
              ["Email/get", { list: [] }, emails.$id],
            ],
            sessionState,
          },
        );

        await expect(parsed).resolves.toEqual({ notFound: ["blob"] });
        await expect(emails).resolves.toEqual({ list: [] });
        expect(apiScope.isDone()).toBe(true);
      });

      it("works on a contacts-only session with no mail capability or mail primary", async () => {
        nock.cleanAll();
        nock(host)
          .get(sessionUrlPath)
          .reply(200, {
            ...DEFAULT_SESSION,
            capabilities: { [core.urn]: coreSessionCapabilities, [contactsUrn]: {} },
            accounts: accountsWith({ "contacts-account": [contactsUrn] }),
            primaryAccounts: { [contactsUrn]: "contacts-account" },
          });
        warnSpy.mockClear();
        const contactsClient = new JsonMetaClient({
          sessionUrl,
          auth: token,
          capabilities: ["contacts"],
        });
        const cards = contactsClient.api.ContactCard.get({ ids: ["c1"] });
        const apiScope = mockApi(
          {
            using: [core.urn, contactsUrn],
            methodCalls: [
              ["ContactCard/get", { accountId: "contacts-account", ids: ["c1"] }, cards.$id],
            ],
          },
          { methodResponses: [["ContactCard/get", { list: [] }, cards.$id]], sessionState },
        );

        await expect(cards).resolves.toEqual({ list: [] });
        expect(apiScope.isDone()).toBe(true);
        expect(warnSpy).not.toHaveBeenCalled();
      });

      it.each([
        { capabilities: ["mail", "smime"], using: [core.urn, mail.urn, smimeUrn] },
        { capabilities: ["smime", "mail"], using: [core.urn, smimeUrn, mail.urn] },
      ] as const)(
        "sends Email calls to the mail primary account with $capabilities",
        async ({ capabilities, using }) => {
          mockSessionWith({ [mail.urn]: "mail-account", [smimeUrn]: "smime-account" });
          const smimeClient = new JsonMetaClient({ sessionUrl, auth: token, capabilities });
          const emails = smimeClient.api.Email.get({ ids: ["e1"] });
          const apiScope = mockApi(
            {
              using: [...using],
              methodCalls: [["Email/get", { accountId: "mail-account", ids: ["e1"] }, emails.$id]],
            },
            { methodResponses: [["Email/get", { list: [] }, emails.$id]], sessionState },
          );

          await expect(emails).resolves.toEqual({ list: [] });
          expect(apiScope.isDone()).toBe(true);
        },
      );

      it("falls back to the only account that supports the owner's capability", async () => {
        mockSessionWith(
          { [mail.urn]: "mail-account" },
          { "mail-account": [mail.urn], "contacts-account": [mail.urn, contactsUrn] },
        );
        const contactsClient = new JsonMetaClient({
          sessionUrl,
          auth: token,
          capabilities: ["contacts"],
        });
        const cards = contactsClient.api.ContactCard.get({ ids: ["c1"] });
        const apiScope = mockApi(
          {
            using: [core.urn, contactsUrn],
            methodCalls: [
              ["ContactCard/get", { accountId: "contacts-account", ids: ["c1"] }, cards.$id],
            ],
          },
          { methodResponses: [["ContactCard/get", { list: [] }, cards.$id]], sessionState },
        );

        await expect(cards).resolves.toEqual({ list: [] });
        expect(apiScope.isDone()).toBe(true);
      });

      it("is left out when no account supports the owner's capability", async () => {
        mockSessionWith({ [mail.urn]: "mail-account" }, { "mail-account": [mail.urn] });
        const contactsClient = new JsonMetaClient({
          sessionUrl,
          auth: token,
          capabilities: ["contacts"],
        });
        const cards = contactsClient.api.ContactCard.get({ ids: ["c1"] });
        const apiScope = mockApi(
          {
            using: [core.urn, contactsUrn],
            methodCalls: [["ContactCard/get", { ids: ["c1"] }, cards.$id]],
          },
          { methodResponses: [["ContactCard/get", { list: [] }, cards.$id]], sessionState },
        );

        await expect(cards).resolves.toEqual({ list: [] });
        expect(apiScope.isDone()).toBe(true);
      });

      describe("when several accounts support the owner's capability", () => {
        let multiClient = new JsonMetaClient({
          sessionUrl,
          auth: token,
          capabilities: ["mail", "contacts"],
        });

        beforeEach(() => {
          mockSessionWith(
            { [mail.urn]: "mail-account" },
            { "mail-account": [mail.urn, contactsUrn], shared: [contactsUrn] },
          );
          multiClient = new JsonMetaClient({
            sessionUrl,
            auth: token,
            capabilities: ["mail", "contacts"],
          });
        });

        it("rejects only the ambiguous method call and sends the rest of the batch", async () => {
          const cards = multiClient.api.ContactCard.get({ ids: ["c1"] });
          const emails = multiClient.api.Email.get({ ids: ["e1"] });
          const apiScope = mockApi(
            {
              using: [core.urn, mail.urn],
              methodCalls: [["Email/get", { accountId: "mail-account", ids: ["e1"] }, emails.$id]],
            },
            { methodResponses: [["Email/get", { list: [] }, emails.$id]], sessionState },
          );

          const [cardsResult, emailsResult] = await Promise.allSettled([cards, emails]);

          expect(emailsResult).toEqual({ status: "fulfilled", value: { list: [] } });
          expect(cardsResult).toEqual({
            status: "rejected",
            reason: expect.any(ConfigurationError),
          });
          expect(cardsResult).toMatchObject({
            reason: {
              message:
                "Cannot choose a default account for ContactCard/get: several accounts " +
                `support ${contactsUrn}, and the session names no primary account for it. ` +
                "Pass `accountId` to choose one.",
            },
          });
          expect(cards.$args).toEqual({ ids: ["c1"] });
          expect(apiScope.isDone()).toBe(true);
        });

        it("still sends a method call that references a rejected one", async () => {
          const query = multiClient.api.ContactCard.query({});
          const emails = multiClient.api.Email.get({ ids: query.resultRef("/ids") });
          const reference = { name: "ContactCard/query", resultOf: query.$id, path: "/ids" };
          const apiScope = mockApi(
            {
              using: [core.urn, mail.urn],
              methodCalls: [
                ["Email/get", { accountId: "mail-account", "#ids": reference }, emails.$id],
              ],
            },
            {
              methodResponses: [["error", { type: "invalidResultReference" }, emails.$id]],
              sessionState,
            },
          );

          await expect(query).rejects.toBeInstanceOf(ConfigurationError);
          await expect(emails).rejects.toMatchObject({
            name: "JmapError",
            type: "invalidResultReference",
          });
          expect(apiScope.isDone()).toBe(true);
        });

        it("makes no HTTP request when every method call in the batch is rejected", async () => {
          await multiClient.session;
          const fetchSpy = vi.spyOn(globalThis, "fetch");

          const results = await Promise.allSettled([
            multiClient.api.ContactCard.get({ ids: ["c1"] }),
            multiClient.api.ContactCard.query({}),
          ]);

          expect(results).toEqual([
            { status: "rejected", reason: expect.any(ConfigurationError) },
            { status: "rejected", reason: expect.any(ConfigurationError) },
          ]);
          expect(fetchSpy).not.toHaveBeenCalled();
          fetchSpy.mockRestore();
        });

        it("keeps an accountId that the caller passes", async () => {
          const cards = multiClient.api.ContactCard.get({ accountId: "shared", ids: ["c1"] });
          const apiScope = mockApi(
            {
              using: [core.urn, contactsUrn],
              methodCalls: [["ContactCard/get", { accountId: "shared", ids: ["c1"] }, cards.$id]],
            },
            { methodResponses: [["ContactCard/get", { list: [] }, cards.$id]], sessionState },
          );

          await expect(cards).resolves.toEqual({ list: [] });
          expect(apiScope.isDone()).toBe(true);
        });
      });

      it("is not added to a method call whose accountId is a result reference", async () => {
        const query = client.api.Mailbox.query({ limit: 1 });
        const emails = client.api.Email.get({
          accountId: query.resultRef("/accountId"),
          ids: ["e1"],
        });
        const reference = { name: "Mailbox/query", resultOf: query.$id, path: "/accountId" };
        const apiScope = mockApi(
          {
            using: [core.urn, mail.urn],
            methodCalls: [
              ["Mailbox/query", { accountId, limit: 1 }, query.$id],
              ["Email/get", { "#accountId": reference, ids: ["e1"] }, emails.$id],
            ],
          },
          {
            methodResponses: [
              ["Mailbox/query", { ids: [] }, query.$id],
              ["Email/get", { list: [] }, emails.$id],
            ],
            sessionState,
          },
        );

        await expect(emails).resolves.toEqual({ list: [] });
        expect(apiScope.isDone()).toBe(true);
      });

      it("is absent from $args until the batch is sent", async () => {
        const freshClient = new JsonMetaClient({ sessionUrl, auth: token, capabilities: [mail] });
        const query = freshClient.api.Mailbox.query({ limit: 1 });
        const apiScope = mockApi(
          {
            using: [core.urn, mail.urn],
            methodCalls: [["Mailbox/query", { accountId, limit: 1 }, query.$id]],
          },
          { methodResponses: [["Mailbox/query", { ids: [] }, query.$id]], sessionState },
        );

        // The session hasn't loaded yet, and reading the arguments doesn't throw
        expect(query.$args).toEqual({ limit: 1 });
        expect(query.$args).not.toHaveProperty("accountId");

        await expect(query).resolves.toEqual({ ids: [] });
        expect(Object.getOwnPropertyDescriptor(query.$args, "accountId")).toEqual({
          value: accountId,
          writable: true,
          enumerable: true,
          configurable: true,
        });
        expect(apiScope.isDone()).toBe(true);
      });

      it("is in the request that beforeJmapRequest hooks receive", async () => {
        const seen: JMAPRequest[] = [];
        const hookClient = new JsonMetaClient({
          sessionUrl,
          auth: token,
          capabilities: [mail],
          hooks: {
            beforeJmapRequest: [
              ({ jmapRequest: request }) => {
                seen.push(structuredClone(request));
                return request;
              },
            ],
          },
        });
        const query = hookClient.api.Mailbox.query({ limit: 1 });
        const request = {
          using: [core.urn, mail.urn],
          methodCalls: [["Mailbox/query", { accountId, limit: 1 }, query.$id]],
        } satisfies JMAPRequest;
        const apiScope = mockApi(request, {
          methodResponses: [["Mailbox/query", { ids: [] }, query.$id]],
          sessionState,
        });

        await expect(query).resolves.toEqual({ ids: [] });
        expect(seen).toEqual([request]);
        expect(apiScope.isDone()).toBe(true);
      });

      it("is not added to Core/echo", async () => {
        const echo = client.api.Core.echo({ hello: "world" });
        const apiScope = mockApi(
          {
            using: [core.urn],
            methodCalls: [["Core/echo", { hello: "world" }, echo.$id]],
          },
          { methodResponses: [["Core/echo", { hello: "world" }, echo.$id]], sessionState },
        );

        await expect(echo).resolves.toEqual({ hello: "world" });
        expect(apiScope.isDone()).toBe(true);
      });

      it("follows a custom capability's defaultAccount setting", async () => {
        const tasks = defineCapability({
          urn: "urn:example:tasks",
          entities: ["Task"],
          defaultAccount: { "*": "primary", "Task/copy": null },
        }).withMethods<{
          Task: {
            get: { input: { accountId: string; ids: string[] }; output: { list: [] } };
            copy: {
              input: { accountId: string; fromAccountId: string; ids: string[] };
              output: { list: [] };
            };
          };
        }>();
        mockSessionWith({ [tasks.urn]: "tasks-account" });
        const tasksClient = new JsonMetaClient({ sessionUrl, auth: token, capabilities: [tasks] });
        const got = tasksClient.api.Task.get({ ids: ["t1"] });
        const copied = untyped(tasksClient.api).Task.copy({
          fromAccountId: "source",
          ids: ["t1"],
        });
        const apiScope = mockApi(
          {
            using: [core.urn, tasks.urn],
            methodCalls: [
              ["Task/get", { accountId: "tasks-account", ids: ["t1"] }, got.$id],
              ["Task/copy", { fromAccountId: "source", ids: ["t1"] }, copied.$id],
            ],
          },
          {
            methodResponses: [
              ["Task/get", { list: [] }, got.$id],
              ["Task/copy", { list: [] }, copied.$id],
            ],
            sessionState,
          },
        );

        await expect(got).resolves.toEqual({ list: [] });
        await expect(copied).resolves.toEqual({ list: [] });
        expect(apiScope.isDone()).toBe(true);
      });

      it("throws when two capabilities claim the same method call", () => {
        const notes = defineCapability({ urn: "urn:example:notes", entities: ["Note"] });
        const vendor = defineCapability({ urn: "urn:example:vendor", entities: ["Note"] });
        expect(
          () => new JsonMetaClient({ sessionUrl, auth: token, capabilities: [notes, vendor] }),
        ).toThrow(CapabilityConfigurationError);
      });
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
        defaultAccount: { "Example/archive": "primary" },
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
        if (!(request instanceof Request)) {
          throw new Error("Expected Request");
        }
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
        if (!(error instanceof HttpError)) {
          throw new Error("Expected HttpError");
        }
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
      const firstHook = vi.fn<BeforeFetchHook>(async ({ httpRequest: request }) => {
        const headers = new Headers(request.headers);
        headers.set("x-first-hook", "first");
        await Promise.resolve();
        return new Request(request, { headers });
      });
      const secondHook = vi.fn<BeforeFetchHook>(({ httpRequest: request }) => {
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
      const firstHook = vi.fn<AfterFetchHook>(async ({ httpResponse: response }) => {
        const headers = new Headers(response.headers);
        headers.set("x-first-hook", "first");
        await Promise.resolve();
        return new Response(response.body, { status: response.status, headers });
      });
      const secondHook = vi.fn<AfterFetchHook>(({ httpResponse: response }) => {
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
