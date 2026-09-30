import { afterEach, describe, expect, it, vi } from "vitest";

import { Client } from "../client.ts";
import {
  JmapClientError,
  JmapConfigurationError,
  JmapError,
  JmapHttpError,
  JmapMethodError,
  JmapProtocolError,
  JmapTransportError,
} from "../index.ts";

const session = {
  apiUrl: "https://example.test/api",
  capabilities: {},
  primaryAccounts: {},
  uploadUrl: "https://example.test/upload/{accountId}",
  downloadUrl: "https://example.test/download/{accountId}/{blobId}/{name}?type={type}",
};

function client() {
  return new Client({
    bearerToken: "token",
    sessionUrl: "https://example.test/session",
    capabilities: [],
  });
}

function mockApi(payload: (id: string) => unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: unknown, init?: RequestInit) => {
      if (init?.method === "GET") return Response.json(session);
      const request = JSON.parse(typeof init?.body === "string" ? init.body : "{}");
      return Response.json(payload(request.methodCalls[0][2]));
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("public structured errors", () => {
  it("retains method details and associates the invocation", async () => {
    const details = { type: "invalidArguments", description: "Bad input", extra: 42 };
    mockApi((id) => ({ methodResponses: [["error", details, id]] }));
    const call = client().api.Core.get({});
    const error = await call.catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(JmapClientError);
    expect(error).toBeInstanceOf(JmapMethodError);
    expect(error).toBeInstanceOf(JmapError);
    expect(error).toMatchObject({
      kind: "method",
      type: details.type,
      description: details.description,
      details,
      cause: details,
      methodCall: ["Core/get", {}, call.id],
      methodCallId: call.id,
    });
  });

  it("preserves HTTP metadata and malformed failure bodies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("broken", { status: 503, headers: { "content-type": "application/json" } }),
      ),
    );
    const error = await client().session.catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(JmapHttpError);
    expect(error).toMatchObject({
      name: "JmapHttpError",
      kind: "http",
      status: 503,
      payload: "broken",
      request: { url: "https://example.test/session", method: "GET" },
      response: { status: 503 },
    });
    expect(error).toHaveProperty("cause", expect.any(SyntaxError));
  });

  it("wraps transport failures preserving their identity", async () => {
    const cause = new TypeError("offline");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(cause));
    await expect(client().session).rejects.toMatchObject({ kind: "transport", cause });
    await expect(client().session).rejects.toBeInstanceOf(JmapTransportError);
  });

  it("distinguishes malformed successful JSON from HTTP errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{")),
    );
    await expect(client().session).rejects.toBeInstanceOf(JmapProtocolError);
    await expect(client().session).rejects.toHaveProperty("cause", expect.any(SyntaxError));
  });

  it.each([null, {}, { apiUrl: 1, capabilities: {}, primaryAccounts: {} }])(
    "rejects unusable sessions: %j",
    async (payload) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => Response.json(payload)),
      );
      await expect(client().session).rejects.toMatchObject({ kind: "protocol", payload });
    },
  );

  it.each([
    () => null,
    () => ({ methodResponses: [["Core/get", null, "wrong"]] }),
    () => ({ methodResponses: [["Core/get", {}, "wrong"]] }),
    () => ({ methodResponses: [] }),
    (id: string) => ({ methodResponses: [["error", {}, id]] }),
    (id: string) => ({
      methodResponses: [
        ["Core/get", {}, id],
        ["Core/get", {}, id],
      ],
    }),
    (id: string) => ({ methodResponses: [["Other/get", {}, id]] }),
  ])("rejects invalid method responses", async (payload) => {
    mockApi(payload);
    await expect(client().api.Core.get({})).rejects.toBeInstanceOf(JmapProtocolError);
  });

  it("accepts implicit method responses without replacing the requested result", async () => {
    mockApi((id) => ({
      methodResponses: [
        ["Core/get", { value: 1 }, id],
        ["Other/set", {}, id],
      ],
    }));
    await expect(client().api.Core.get({})).resolves.toEqual({ value: 1 });
  });

  it("reports configuration failures before fetching", () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    vi.stubGlobal("fetch", fetch);
    expect(
      () => new Client({ bearerToken: "", sessionUrl: session.apiUrl, capabilities: [] }),
    ).toThrow(JmapConfigurationError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects cyclic method arguments as configuration failures", () => {
    const args: Record<string, unknown> = {};
    Object.defineProperty(args, "self", { value: args, enumerable: true });
    expect(() => client().api.Core.get(args)).toThrow(JmapConfigurationError);
  });

  it("preserves serialization failures as configuration causes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(session)));
    const instance = new Client({
      bearerToken: "token",
      sessionUrl: session.apiUrl,
      capabilities: [],
      middleware: [
        (args) => {
          if (typeof args === "object" && args !== null && !Array.isArray(args))
            Object.defineProperty(args, "self", { value: args, enumerable: true });
          return args;
        },
      ],
    });
    await expect(instance.api.Core.get({})).rejects.toMatchObject({
      kind: "configuration",
      cause: expect.any(TypeError),
    });
  });

  it("preserves errors thrown by application middleware", async () => {
    const cause = new Error("application failure");
    const instance = new Client({
      bearerToken: "token",
      sessionUrl: session.apiUrl,
      capabilities: [],
      middleware: [
        () => {
          throw cause;
        },
      ],
    });
    expect(() => instance.api.Core.get({})).toThrow(cause);
  });

  it("classifies upload data and download failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json(session))
        .mockResolvedValueOnce(Response.json({ invalid: true })),
    );
    await expect(client().blob.upload("body", { accountId: "a" })).rejects.toBeInstanceOf(
      JmapProtocolError,
    );
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json(session))
        .mockResolvedValueOnce(new Response("missing", { status: 404 })),
    );
    await expect(
      client().blob.download({ accountId: "a", blobId: "b", name: "n", type: "text/plain" }),
    ).rejects.toMatchObject({ kind: "http", status: 404, payload: "missing" });
  });
  it("classifies body read failures as transport errors", async () => {
    const cause = new Error("connection interrupted");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            new ReadableStream({
              start(controller) {
                controller.error(cause);
              },
            }),
          ),
      ),
    );
    await expect(client().session).rejects.toMatchObject({ kind: "transport", cause });
  });

  it("rejects invalid session account IDs as server protocol failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ ...session, primaryAccounts: { mail: 42 } })),
    );
    await expect(client().session).rejects.toBeInstanceOf(JmapProtocolError);
  });
});
