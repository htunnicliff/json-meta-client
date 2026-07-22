import type { Invocation } from "jmap-rfc-types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Client, JmapError, KNOWN_CAPABILITIES, ref } from "../index.ts";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
  return new Client({
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
    const [, init] = fetchMock.mock.calls[0];
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
      const [, , id] = body.methodCalls[0];
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
      const [, , id] = body.methodCalls[0];
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

describe("Client result references", () => {
  it("rewrites ref-valued argument keys with a # prefix on the wire", async () => {
    let sentCalls: Invocation[] = [];
    stubFetch((body) => {
      sentCalls = body.methodCalls;
      return echoApi(body);
    });
    const client = makeClient();

    const query = client.api.Mailbox.query({ accountId: "a1" });
    await client.api.Mailbox.get({
      accountId: "a1",
      ids: ref(query, "/ids"),
    });

    expect(sentCalls).toHaveLength(2);
    const [, getArgs] = sentCalls[1];
    expect(getArgs).toEqual({
      accountId: "a1",
      "#ids": {
        name: "Mailbox/query",
        resultOf: query.id,
        path: "/ids",
      },
    });
    expect(getArgs).not.toHaveProperty("ids");
  });

  it("serialises only name, resultOf, and path (no internal ref marker)", async () => {
    let rawBody = "";
    stubFetch((body) => {
      rawBody = JSON.stringify(body);
      return echoApi(body);
    });
    const client = makeClient();

    const query = client.api.Mailbox.query({ accountId: "a1" });
    await client.api.Mailbox.get({
      accountId: "a1",
      ids: ref(query, "/ids"),
    });

    const parsed = parseBody({ body: rawBody });
    const [, getArgs] = parsed.methodCalls[1];
    if (!isRecord(getArgs) || !isRecord(getArgs["#ids"])) {
      throw new Error("expected get args to contain a #ids result reference");
    }
    const resultRef = getArgs["#ids"];

    expect(Object.keys(resultRef).toSorted()).toEqual(["name", "path", "resultOf"]);
    expect(rawBody).not.toMatch(/Symbol\(|refSymbol|"__type"/);
  });

  it("batches a query and a dependent get into one HTTP request", async () => {
    const fetchMock = stubFetch((body) => {
      const [queryCall, getCall] = body.methodCalls;
      return jsonResponse({
        methodResponses: [
          inv("Mailbox/query", { ids: ["mb1", "mb2"], queryState: "q0", position: 0 }, queryCall[2]),
          inv(
            "Mailbox/get",
            { list: [{ id: "mb1" }, { id: "mb2" }], notFound: [] },
            getCall[2],
          ),
        ],
        sessionState: "s0",
      });
    });
    const client = makeClient();

    const query = client.api.Mailbox.query({ accountId: "a1" });
    const get = client.api.Mailbox.get({
      accountId: "a1",
      ids: ref(query, "/ids"),
    });
    const [queryResult, getResult] = await Promise.all([query, get]);

    expect(fetchMock.mock.calls.filter(([url]) => url === API_URL)).toHaveLength(1);
    expect(queryResult).toMatchObject({ ids: ["mb1", "mb2"] });
    expect(getResult).toMatchObject({ list: [{ id: "mb1" }, { id: "mb2" }] });
  });

  it("supports wildcard JSON Pointer paths", async () => {
    let sentCalls: Invocation[] = [];
    stubFetch((body) => {
      sentCalls = body.methodCalls;
      return echoApi(body);
    });
    const client = makeClient();

    const get = client.api.Mailbox.get({ accountId: "a1", ids: ["mb1"] });
    await client.api.Mailbox.get({
      accountId: "a1",
      ids: ref(get, "/list/*/id"),
    });

    const [, secondArgs] = sentCalls[1];
    expect(secondArgs).toMatchObject({
      "#ids": {
        name: "Mailbox/get",
        resultOf: get.id,
        path: "/list/*/id",
      },
    });
  });

  it("rewrites nested refs inside objects and arrays of objects", async () => {
    let sentCalls: Invocation[] = [];
    stubFetch((body) => {
      sentCalls = body.methodCalls;
      return echoApi(body);
    });
    const client = makeClient();

    const parent = client.api.Mailbox.get({ accountId: "a1", ids: ["mb-parent"] });
    await client.api.Mailbox.set({
      accountId: "a1",
      create: {
        child: {
          name: "Child",
          parentId: ref(parent, "/list/0/id"),
        },
      },
      // Exercise array traversal: refs on keys inside array elements are rewritten
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- force invalid update shape through the client
      update: [
        {
          id: "mb2",
          parentId: ref(parent, "/list/0/id"),
        },
      ] as never,
    });

    const [, setArgs] = sentCalls[1];
    expect(setArgs).toEqual({
      accountId: "a1",
      create: {
        child: {
          name: "Child",
          "#parentId": {
            name: "Mailbox/get",
            resultOf: parent.id,
            path: "/list/0/id",
          },
        },
      },
      update: [
        {
          id: "mb2",
          "#parentId": {
            name: "Mailbox/get",
            resultOf: parent.id,
            path: "/list/0/id",
          },
        },
      ],
    });
  });

  it("leaves ordinary values and lookalike objects unprefixed", async () => {
    let sentCalls: Invocation[] = [];
    stubFetch((body) => {
      sentCalls = body.methodCalls;
      return echoApi(body);
    });
    const client = makeClient();

    const lookalike = {
      name: "Mailbox/query",
      resultOf: "someone-elses-id",
      path: "/ids",
    };

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- force an extra property through the client
    await client.api.Mailbox.get({
      accountId: "a1",
      ids: ["mb1"],
      also: lookalike,
    } as never);

    const [, args] = sentCalls[0];
    expect(args).toEqual({
      accountId: "a1",
      ids: ["mb1"],
      also: lookalike,
    });
    expect(args).not.toHaveProperty("#also");
    expect(args).not.toHaveProperty("#ids");
  });

  it("can attach multiple refs in a single method call", async () => {
    let sentCalls: Invocation[] = [];
    stubFetch((body) => {
      sentCalls = body.methodCalls;
      return echoApi(body);
    });
    const client = makeClient();

    const query = client.api.Mailbox.query({ accountId: "a1" });
    const priorGet = client.api.Mailbox.get({ accountId: "a1", ids: ["mb0"] });
    await client.api.Mailbox.set({
      accountId: "a1",
      create: {
        a: {
          name: "A",
          parentId: ref(priorGet, "/list/0/id"),
        },
      },
      destroy: ref(query, "/ids"),
    });

    const [, setArgs] = sentCalls[2];
    expect(setArgs).toMatchObject({
      create: {
        a: {
          "#parentId": {
            name: "Mailbox/get",
            resultOf: priorGet.id,
            path: "/list/0/id",
          },
        },
      },
      "#destroy": {
        name: "Mailbox/query",
        resultOf: query.id,
        path: "/ids",
      },
    });
  });

  it("preserves sibling non-ref keys alongside a rewritten ref", async () => {
    let sentCalls: Invocation[] = [];
    stubFetch((body) => {
      sentCalls = body.methodCalls;
      return echoApi(body);
    });
    const client = makeClient();

    const query = client.api.Mailbox.query({ accountId: "a1" });
    await client.api.Mailbox.get({
      accountId: "a1",
      ids: ref(query, "/ids"),
      properties: ["id", "name"],
    });

    const [, getArgs] = sentCalls[1];
    expect(getArgs).toEqual({
      accountId: "a1",
      properties: ["id", "name"],
      "#ids": {
        name: "Mailbox/query",
        resultOf: query.id,
        path: "/ids",
      },
    });
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

    await expect(client.getSession()).rejects.toThrow("JMAP request failed (400)");
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
