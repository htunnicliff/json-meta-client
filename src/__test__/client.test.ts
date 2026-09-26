import type {
  BlobUploadResponse,
  Request as JMAPRequest,
  Response as JMAPResponse,
  ProblemDetails,
  Session,
} from "jmap-rfc-types";
import nock, { type Scope } from "nock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mail } from "../capabilities/mail.ts";
import { defineCapability } from "../capability.ts";
import { Client } from "../client.ts";
import { JmapError } from "../error.ts";
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

const DEFAULT_SESSION = {
  apiUrl,
  primaryAccounts: {
    "urn:ietf:params:jmap:mail": accountId,
  },
  uploadUrl,
  downloadUrl,
} satisfies Partial<Session>;

// ------ Mocking Utils -----------------------------------

function mockSession(): Scope {
  return nock(host).get(sessionUrlPath).reply(200, DEFAULT_SESSION);
}

function mockApi(request: JMAPRequest, response: JMAPResponse): Scope {
  return nock(host).post(apiUrlPath, request).reply(200, response);
}

// ------ Mocks -------------------------------------------

describe("Client", () => {
  let sessionScope: Scope;
  let client = new Client({ sessionUrl, bearerToken, capabilities: [mail] });

  beforeEach(() => {
    client = new Client({ sessionUrl, bearerToken, capabilities: [mail] });
    sessionScope = mockSession();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it("exposes the public client interface", async () => {
    expect(client).toHaveProperty("api");
    expect(client).toHaveProperty("session");
    expect(client.refreshSession).toBeTypeOf("function");
    const session = await client.session;
    expect(session).toEqual(DEFAULT_SESSION);
  });

  it("is frozen", () => {
    expect(Object.isFrozen(client)).toBe(true);
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
        () => new Client({ sessionUrl: "invalid-url", bearerToken, capabilities: [mail] }),
      ).toThrow("Invalid session URL");
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
    it("sends a JMAP request with required capabilities and injected account ID", async () => {
      const query = client.api.Mailbox.query({
        limit: 3,
        filter: {
          hasAnyRole: true,
        },
      });

      const apiScope = mockApi(
        {
          using: ["urn:ietf:params:jmap:mail", "urn:ietf:params:jmap:core"],
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
          using: ["urn:ietf:params:jmap:mail", "urn:ietf:params:jmap:core"],
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
          using: ["urn:ietf:params:jmap:mail", "urn:ietf:params:jmap:core"],
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
          using: ["urn:ietf:params:jmap:mail", "urn:ietf:params:jmap:core"],
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
          using: ["urn:ietf:params:jmap:mail", "urn:ietf:params:jmap:core"],
          methodCalls: [["Mailbox/query", { accountId, limit: 1 }, query.id]],
        },
        { methodResponses: [["error", cause, query.id]], sessionState },
      );

      await expect(query).rejects.toMatchObject({
        name: "JmapError",
        type: cause.type,
        detail: cause.detail,
        cause,
      } satisfies Partial<JmapError>);
      expect(sessionScope.isDone()).toBe(true);
      expect(apiScope.isDone()).toBe(true);
    });

    it("rejects method calls missing from a JMAP response", async () => {
      const mailboxQuery = client.api.Mailbox.query({ limit: 1 });
      const emailQuery = client.api.Email.query({ limit: 1 });
      const apiScope = mockApi(
        {
          using: ["urn:ietf:params:jmap:mail", "urn:ietf:params:jmap:core"],
          methodCalls: [
            ["Mailbox/query", { accountId, limit: 1 }, mailboxQuery.id],
            ["Email/query", { accountId, limit: 1 }, emailQuery.id],
          ],
        },
        { methodResponses: [["Mailbox/query", { ids: [] }, mailboxQuery.id]], sessionState },
      );

      await expect(mailboxQuery).resolves.toEqual({ ids: [] });
      await expect(emailQuery).rejects.toThrow(`No response for method call "${emailQuery.id}"`);
      expect(sessionScope.isDone()).toBe(true);
      expect(apiScope.isDone()).toBe(true);
    });

    it("preserves JSON and text HTTP failure payloads as error causes", async () => {
      nock.cleanAll();
      const sessionFailure: ProblemDetails = { type: "serverFail" };
      const failedSessionScope = nock(host).get(sessionUrlPath).reply(500, sessionFailure);
      const rejectedError = {
        message: "JMAP request failed (500)",
        cause: sessionFailure,
      };
      await expect(client.session).rejects.toMatchObject(rejectedError);
      expect(failedSessionScope.isDone()).toBe(true);
      const query = client.api.Mailbox.query({ limit: 1 });
      await expect(query).rejects.toMatchObject(rejectedError);
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

      const client = new Client({
        capabilities: [example],
        sessionUrl,
        bearerToken,
      });

      const get = client.api.Example.get({ value: "hello" });

      const apiScope = mockApi(
        {
          using: [example.urn, "urn:ietf:params:jmap:core"],
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
          using: ["urn:ietf:params:jmap:mail", "urn:ietf:params:jmap:core"],
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
