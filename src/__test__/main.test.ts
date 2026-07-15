import type { Invocation } from "jmap-rfc-types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Client, type GlobalEntity, JmapError, KNOWN_CAPABILITIES } from "../main.ts";

const SESSION_URL = "https://jmap.example.com/.well-known/jmap";
const API_URL = "https://jmap.example.com/api";

interface ApiRequestBody {
  using: string[];
  methodCalls: Invocation[];
}

/** Construct a properly typed JMAP {@link Invocation} tuple. */
function inv(name: string, args: unknown, id: string): Invocation {
  return [name, args, id];
}

function jsonResponse(body: unknown, init?: { status?: number }): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "content-type": "application/json" },
  });
}

function parseBody(init?: RequestInit): ApiRequestBody {
  const raw = typeof init?.body === "string" ? init.body : "{}";
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- JSON.parse is `any`
  return JSON.parse(raw);
}

/**
 * Stub `fetch` with a handler that dispatches on url + parsed body. The GET to
 * the session url returns a minimal session pointing at `API_URL`.
 */
function stubFetch(onApiRequest: (body: ApiRequestBody) => Response) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === SESSION_URL) {
      return jsonResponse({ apiUrl: API_URL, state: "s0" });
    }
    if (url === API_URL) {
      return onApiRequest(parseBody(init));
    }
    throw new Error(`unexpected fetch to ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Echo every method call back as its own result, keyed by id. */
function echoApi(body: ApiRequestBody): Response {
  const methodResponses = body.methodCalls.map(([name, , id]) => inv(name, { id }, id));
  return jsonResponse({ methodResponses, sessionState: "s0" });
}

function makeClient() {
  return new Client<GlobalEntity>({
    bearerToken: "secret-token",
    sessionUrl: SESSION_URL,
    capabilities: KNOWN_CAPABILITIES,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Client.getSession", () => {
  it("fetches the session with auth headers", async () => {
    const fetchMock = stubFetch(echoApi);
    const client = makeClient();

    const session = await client.getSession();

    expect(session).toEqual({ apiUrl: API_URL, state: "s0" });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init?.method).toBe("GET");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer secret-token");
  });

  it("caches the session across calls", async () => {
    const fetchMock = stubFetch(echoApi);
    const client = makeClient();

    const a = await client.getSession();
    const b = await client.getSession();

    expect(a).toBe(b);
    const sessionFetches = fetchMock.mock.calls.filter(([url]) => url === SESSION_URL);
    expect(sessionFetches).toHaveLength(1);
  });
});

describe("Client.api", () => {
  it("dispatches a method call and resolves with the result args", async () => {
    stubFetch((body) => {
      const [, , id] = body.methodCalls[0]!;
      return jsonResponse({
        methodResponses: [inv("Mailbox/get", { list: [{ id: "mb1" }] }, id)],
        sessionState: "s0",
      });
    });
    const client = makeClient();

    const result = await client.api.Mailbox.get({
      accountId: "a1",
      ids: ["mb1"],
    });

    expect(result).toEqual({ list: [{ id: "mb1" }] });
  });

  it("sends the request to the session apiUrl as a POST", async () => {
    const fetchMock = stubFetch(echoApi);
    const client = makeClient();

    await client.api.Mailbox.get({ accountId: "a1", ids: [] });

    const apiCall = fetchMock.mock.calls.find(([url]) => url === API_URL)!;
    expect(apiCall[1]?.method).toBe("POST");
  });

  it("computes `using` from the invoked methods", async () => {
    let sentUsing: string[] = [];
    stubFetch((body) => {
      sentUsing = body.using;
      return echoApi(body);
    });
    const client = makeClient();

    await client.api.Mailbox.get({ accountId: "a1", ids: [] });

    expect(sentUsing).toContain("urn:ietf:params:jmap:core");
    expect(sentUsing).toContain("urn:ietf:params:jmap:mail");
  });

  it("batches concurrent calls into a single HTTP request", async () => {
    const fetchMock = stubFetch(echoApi);
    const client = makeClient();

    await Promise.all([
      client.api.Mailbox.get({ accountId: "a1", ids: [] }),
      client.api.Email.get({ accountId: "a1", ids: [] }),
    ]);

    const apiCalls = fetchMock.mock.calls.filter(([url]) => url === API_URL);
    expect(apiCalls).toHaveLength(1);
  });

  it("rejects with a JmapError on a method-level error", async () => {
    stubFetch((body) => {
      const [, , id] = body.methodCalls[0]!;
      return jsonResponse({
        methodResponses: [inv("error", { type: "urn:ietf:params:jmap:error:serverFail" }, id)],
        sessionState: "s0",
      });
    });
    const client = makeClient();

    await expect(client.api.Mailbox.get({ accountId: "a1", ids: [] })).rejects.toBeInstanceOf(
      JmapError,
    );
  });
});

describe("Client error handling", () => {
  it("throws a JmapError when the server returns problem details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ type: "urn:ietf:params:jmap:error:unknownCapability" }, { status: 400 }),
      ),
    );
    const client = makeClient();

    await expect(client.getSession()).rejects.toBeInstanceOf(JmapError);
  });

  it("throws a generic Error for non-problem-details failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("nope", {
            status: 500,
            headers: { "content-type": "text/plain" },
          }),
      ),
    );
    const client = makeClient();

    await expect(client.getSession()).rejects.toThrow("JMAP request failed (500)");
  });
});
