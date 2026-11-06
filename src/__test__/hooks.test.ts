// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import nock from "nock";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { OnStateChangeHandler } from "../index.ts";
import { JsonMetaClient, NetworkError } from "../index.ts";
import { accountId, host, makeSession, mockSession, sessionUrl, sessionState } from "./fixtures.ts";

afterEach(() => {
  nock.cleanAll();
  vi.unstubAllGlobals();
});

describe("Fetch hooks", () => {
  it("chains async hooks after authentication and legacy hooks on every HTTP path", async () => {
    const seen: string[] = [];
    const scope = nock(host, { reqheaders: { authorization: "Bearer token", "x-hook": "second" } })
      .get(new URL(sessionUrl).pathname)
      .reply(200, makeSession())
      .post("/special-jmap-api")
      .reply(200, { sessionState, methodResponses: [["Core/echo", { ok: true }, "echo"]] })
      .post(`/upload/${encodeURIComponent(accountId)}`, "upload")
      .reply(200, { blobId: "blob" })
      .get(`/download/${encodeURIComponent(accountId)}/blob`)
      .query(true)
      .reply(200, "download");
    const client = new JsonMetaClient({
      sessionUrl,
      capabilities: [],
      auth: { token: "token" },
      hooks: {
        beforeRequest: [
          ({ request }) => {
            expect(request.headers.get("authorization")).toBe("Bearer token");
            request.headers.set("x-hook", "legacy");
            return request;
          },
        ],
        beforeFetch: [
          async ({ request }) => {
            expect(request.headers.get("x-hook")).toBe("legacy");
            await Promise.resolve();
            const headers = new Headers(request.headers);
            headers.set("x-hook", "first");
            return new Request(request, { headers });
          },
          ({ request }) => {
            expect(request.headers.get("x-hook")).toBe("first");
            request.headers.set("x-hook", "second");
            return request;
          },
        ],
        afterResponse: [
          ({ response }) => new Response(response.body, { headers: { "x-response": "legacy" } }),
        ],
        afterFetch: [
          async ({ request, response }) => {
            seen.push(new URL(request.url).pathname);
            expect(request.headers.get("x-hook")).toBe("second");
            expect(response.headers.get("x-response")).toBe("legacy");
            await Promise.resolve();
            return new Response(response.body, { headers: { "x-response": "first" } });
          },
          ({ response }) => {
            expect(response.headers.get("x-response")).toBe("first");
            return response;
          },
        ],
      },
    });
    await client.session;
    await expect(client.api.Core.echo({}, { id: "echo" })).resolves.toEqual({ ok: true });
    await client.blob.upload("upload", { accountId });
    const download = await client.blob.download({
      accountId,
      blobId: "blob",
      type: "text/plain",
      name: "file",
    });
    expect(await download.text()).toBe("download");
    expect(seen).toEqual([
      new URL(sessionUrl).pathname,
      "/special-jmap-api",
      `/upload/${encodeURIComponent(accountId)}`,
      `/download/${encodeURIComponent(accountId)}/blob`,
    ]);
    expect(scope.isDone()).toBe(true);
  });
});

describe("JMAP envelope hooks", () => {
  it("transforms one envelope per batch after middleware and before per-method results", async () => {
    mockSession();
    let envelopes = 0;
    let responses = 0;
    const scope = nock(host)
      .post("/special-jmap-api", {
        using: ["urn:ietf:params:jmap:core", "urn:example:extra"],
        methodCalls: [
          ["Core/echo", { value: "first", accountId, middleware: true }, "first"],
          ["Core/echo", { value: "second", accountId, middleware: true }, "second"],
        ],
        createdIds: { local: "remote" },
      })
      .reply(200, {
        sessionState,
        methodResponses: [
          ["Core/echo", { value: "raw" }, "first"],
          ["error", { type: "invalidArguments" }, "second"],
        ],
      });
    const client = new JsonMetaClient({
      sessionUrl,
      auth: { token: "token" },
      capabilities: [],
      middleware: [(args) => ({ ...Object(args), middleware: true })],
      hooks: {
        beforeJmapRequest: [
          async ({ request }) => {
            envelopes++;
            expect(request.methodCalls).toHaveLength(2);
            expect(request.methodCalls[0]![1]).toMatchObject({ accountId, middleware: true });
            await Promise.resolve();
            return { ...request, using: [...request.using, "urn:example:extra"] };
          },
          ({ request }) => {
            expect(request.using).toContain("urn:example:extra");
            return { ...request, createdIds: { local: "remote" } };
          },
        ],
        afterJmapResponse: [
          async ({ request, response }) => {
            responses++;
            expect(request.createdIds).toEqual({ local: "remote" });
            await Promise.resolve();
            return {
              ...response,
              methodResponses: [
                ["Core/echo", { value: "changed" }, "first"],
                response.methodResponses[1]!,
              ],
            };
          },
          ({ response }) => {
            expect(response.methodResponses[0]![1]).toEqual({ value: "changed" });
            return response;
          },
        ],
      },
    });
    await client.session;
    const results = await Promise.allSettled([
      client.api.Core.echo({ value: "first" }, { id: "first" }),
      client.api.Core.echo({ value: "second" }, { id: "second" }),
    ]);
    expect(results).toEqual([
      { status: "fulfilled", value: { value: "changed" } },
      {
        status: "rejected",
        reason: expect.objectContaining({ name: "JmapError", type: "invalidArguments" }),
      },
    ]);
    expect(envelopes).toBe(1);
    expect(responses).toBe(1);
    expect(scope.isDone()).toBe(true);
  });
});

describe("event-stream connection hooks", () => {
  it("awaits connection hooks on real reconnects without consuming streaming bodies", async () => {
    mockSession();
    const order: string[] = [];
    const scope = nock(host, {
      reqheaders: { "x-connect": "ready", authorization: "Custom stream" },
    })
      .get("/events")
      .query(true)
      .reply(
        200,
        'retry: 1\nid: first\ndata: {"@type":"StateChange","changed":{"account":{"Email":"first"}}}\n\n',
        { "content-type": "text/event-stream" },
      )
      .get("/events")
      .query(true)
      .matchHeader("last-event-id", "first")
      .reply(200, 'data: {"@type":"StateChange","changed":{"account":{"Email":"second"}}}\n\n', {
        "content-type": "text/event-stream; charset=utf-8",
      });
    const controller = new AbortController();
    const handler = vi.fn<OnStateChangeHandler>();
    const client = new JsonMetaClient({
      sessionUrl,
      capabilities: [],
      auth: ({ request }) => {
        if (new URL(request.url).pathname === "/events") {
          order.push("auth");
          request.headers.set("authorization", "Custom stream");
        }
      },
      hooks: {
        beforeFetch: [
          ({ request }) => {
            if (new URL(request.url).pathname === "/events") {
              order.push("beforeFetch");
            }
            return request;
          },
        ],
        beforeEventSourceConnect: [
          async ({ request }) => {
            order.push("beforeConnect");
            await Promise.resolve();
            return new Request(request, {
              headers: { ...Object.fromEntries(request.headers), "x-connect": "ready" },
            });
          },
        ],
        afterFetch: [
          ({ request, response }) => {
            if (new URL(request.url).pathname !== "/events") return response;
            order.push("afterFetch");
            return new Response(response.body, {
              headers: {
                "content-type": response.headers.get("content-type")!,
                "x-observed": "yes",
              },
            });
          },
        ],
        afterEventSourceConnect: [
          async ({ request, response }) => {
            await Promise.resolve();
            order.push("afterConnect");
            expect(request.headers.get("x-connect")).toBe("ready");
            expect(response.headers.get("x-observed")).toBe("yes");
            expect(response.bodyUsed).toBe(false);
            expect(response.body?.locked).toBe(false);
          },
        ],
      },
    });
    const subscription = await client.onStateChange(
      (...args) => {
        handler(...args);
        if (args[1]) order.push(args[1].state);
        if (args[1]?.state === "second") controller.abort();
      },
      { signal: controller.signal },
    );
    try {
      await vi.waitFor(() =>
        expect(handler).toHaveBeenCalledWith(null, expect.objectContaining({ state: "second" })),
      );
      expect(scope.isDone()).toBe(true);
      expect(order).toEqual([
        "auth",
        "beforeFetch",
        "beforeConnect",
        "afterFetch",
        "afterConnect",
        "first",
        "auth",
        "beforeFetch",
        "beforeConnect",
        "afterFetch",
        "afterConnect",
        "second",
      ]);
    } finally {
      controller.abort();
      subscription[Symbol.dispose]();
    }
  });
});

it.each([
  { status: 401, contentType: "application/json" },
  { status: 201, contentType: "text/event-stream" },
  { status: 200, contentType: "text/html" },
])(
  "reports invalid stream connections before connection observers: $status $contentType",
  async ({ status, contentType }) => {
    const cancel = vi.fn<() => void>();
    const stream = new ReadableStream({ cancel });
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(makeSession()))
      .mockResolvedValueOnce(
        new Response(stream, { status, headers: { "content-type": contentType } }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const afterConnect = vi.fn<() => void>();
    const controller = new AbortController();
    const handler = vi.fn<OnStateChangeHandler>();
    const client = new JsonMetaClient({
      sessionUrl,
      capabilities: [],
      auth: { token: "token" },
      hooks: { afterEventSourceConnect: [afterConnect] },
    });
    const subscription = await client.onStateChange(
      (...args) => {
        handler(...args);
        controller.abort();
      },
      { signal: controller.signal },
    );
    try {
      await vi.waitFor(() =>
        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "StateChangeError",
            cause: expect.objectContaining({ name: "HttpError", status }),
          }),
          undefined,
        ),
      );
      expect(afterConnect).not.toHaveBeenCalled();
      expect(cancel).toHaveBeenCalledOnce();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      controller.abort();
      subscription[Symbol.dispose]();
    }
  },
);

it.each(["beforeJmapRequest", "afterJmapResponse"] as const)(
  "rejects every call in a batch when %s fails",
  async (phase) => {
    mockSession();
    const scope = nock(host)
      .post("/special-jmap-api")
      .reply(200, { sessionState, methodResponses: [] });
    const failure = new Error("Envelope hook failed");
    const client = new JsonMetaClient({
      sessionUrl,
      capabilities: [],
      auth: { token: "token" },
      hooks: {
        [phase]: [
          async () => {
            throw failure;
          },
        ],
      },
    });
    await client.session;
    const results = await Promise.allSettled([
      client.api.Core.echo({}, { id: "a" }),
      client.api.Core.echo({}, { id: "b" }),
    ]);
    expect(results).toEqual([
      { status: "rejected", reason: failure },
      { status: "rejected", reason: failure },
    ]);
    expect(scope.isDone()).toBe(phase === "afterJmapResponse");
  },
);

it("preserves request-hook error wrapping and response-hook error identity", async () => {
  const failure = new Error("Hook failed");
  const scope = mockSession();
  const before = new JsonMetaClient({
    sessionUrl,
    capabilities: [],
    auth: { token: "token" },
    hooks: {
      beforeFetch: [
        async () => {
          throw failure;
        },
      ],
    },
  });
  await expect(before.session).rejects.toMatchObject({ name: NetworkError.name, cause: failure });
  expect(scope.isDone()).toBe(false);
  const after = new JsonMetaClient({
    sessionUrl,
    capabilities: [],
    auth: { token: "token" },
    hooks: {
      afterFetch: [
        async () => {
          throw failure;
        },
      ],
    },
  });
  await expect(after.session).rejects.toBe(failure);
  expect(scope.isDone()).toBe(true);
});

it("allows afterFetch to repair HTTP errors before validation and JSON parsing", async () => {
  nock(host).get(new URL(sessionUrl).pathname).reply(503, "unavailable");
  const client = new JsonMetaClient({
    sessionUrl,
    capabilities: [],
    auth: { token: "token" },
    hooks: {
      afterFetch: [
        ({ response }) => {
          expect(response.status).toBe(503);
          return Response.json(makeSession());
        },
      ],
    },
  });
  await expect(client.session).resolves.toEqual(makeSession());
});

it("does not report a connection for HTTP 204 or retry after server closure", async () => {
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json(makeSession()))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
  const afterConnect = vi.fn<() => void>();
  const handler = vi.fn<OnStateChangeHandler>();
  const client = new JsonMetaClient({
    sessionUrl,
    capabilities: [],
    auth: { token: "token" },
    hooks: { afterEventSourceConnect: [afterConnect] },
  });
  const subscription = await client.onStateChange(handler);
  try {
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(afterConnect).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  } finally {
    subscription[Symbol.dispose]();
  }
});

it.each(["beforeEventSourceConnect", "afterEventSourceConnect"] as const)(
  "reports %s rejection through the state-change handler",
  async (phase) => {
    const cancel = vi.fn<() => void>();
    const stream = new ReadableStream({ cancel });
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(makeSession()))
      .mockResolvedValueOnce(
        new Response(stream, { headers: { "content-type": "text/event-stream" } }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const failure = new Error("Connection hook failed");
    const handler = vi.fn<OnStateChangeHandler>();
    const controller = new AbortController();
    const client = new JsonMetaClient({
      sessionUrl,
      capabilities: [],
      auth: { token: "token" },
      hooks: {
        [phase]: [
          async () => {
            throw failure;
          },
        ],
      },
    });
    const subscription = await client.onStateChange(
      (...args) => {
        handler(...args);
        controller.abort();
      },
      { signal: controller.signal },
    );
    const wrappedFailure = expect.objectContaining({ name: NetworkError.name, cause: failure });
    const expectedCause = phase === "beforeEventSourceConnect" ? wrappedFailure : failure;
    try {
      await vi.waitFor(() =>
        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "StateChangeError",
            cause: expectedCause,
          }),
          undefined,
        ),
      );
      expect(fetchMock).toHaveBeenCalledTimes(phase === "beforeEventSourceConnect" ? 1 : 2);
      expect(cancel).toHaveBeenCalledTimes(phase === "afterEventSourceConnect" ? 1 : 0);
    } finally {
      controller.abort();
      subscription[Symbol.dispose]();
    }
  },
);

it("does not report a connection failure when the subscription is aborted", async () => {
  const fetching = Promise.withResolvers<void>();
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json(makeSession()))
    .mockImplementationOnce(async (request) => {
      if (!(request instanceof Request)) throw new Error("Expected Request");
      fetching.resolve();
      await new Promise((_, reject) =>
        request.signal.addEventListener("abort", () => reject(request.signal.reason), {
          once: true,
        }),
      );
      throw new Error("Unreachable");
    });
  vi.stubGlobal("fetch", fetchMock);
  const controller = new AbortController();
  const handler = vi.fn<OnStateChangeHandler>();
  const client = new JsonMetaClient({ sessionUrl, capabilities: [], auth: { token: "token" } });
  const subscription = await client.onStateChange(handler, { signal: controller.signal });
  try {
    await fetching.promise;
    controller.abort();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(handler).not.toHaveBeenCalled();
  } finally {
    controller.abort();
    subscription[Symbol.dispose]();
  }
});
