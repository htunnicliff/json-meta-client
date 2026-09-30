import type { Request as JmapRequest } from "jmap-rfc-types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { core } from "../capabilities/core.ts";
import { defineCapability } from "../capability.ts";
import { Client } from "../client.ts";
import { JmapRequestLimitError } from "../error.ts";
import type { RequestLimits } from "../internal/request-limits.ts";
import type { Middleware } from "../internal/types.ts";
import { ref } from "../ref.ts";

const example = defineCapability({ urn: "urn:example:test", entities: ["Example"] }).withMethods<{
  Example: { get: { input: { value: string }; output: { value: string } } };
}>();
const apiUrl = "https://example.test/api";

function setup(
  limits: RequestLimits,
  respond?: (request: JmapRequest) => Response | Promise<Response>,
  middleware?: readonly Middleware[],
) {
  const requests: JmapRequest[] = [];
  const client = new Client({
    sessionUrl: "https://example.test/session",
    bearerToken: "token",
    capabilities: [example],
    middleware,
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options?: RequestInit) => {
      if (url !== apiUrl) {
        return Response.json({
          apiUrl,
          capabilities: { [core.urn]: limits, [example.urn]: {} },
          primaryAccounts: {},
        });
      }
      if (typeof options?.body !== "string") throw new Error("Expected JSON request body");
      const request: JmapRequest = JSON.parse(options.body);
      requests.push(request);
      return respond ? respond(request) : reply(request);
    }),
  );
  return { client, requests };
}

function reply(request: JmapRequest) {
  return Response.json({
    methodResponses: request.methodCalls.map(([method, args, id]) => [method, args, id]),
    sessionState: "state",
  });
}

function values(requests: JmapRequest[]) {
  return requests.map((request) => request.methodCalls.map(([, args]) => args));
}

afterEach(() => vi.unstubAllGlobals());

describe("server request limits", () => {
  it.each([2, 3])("sends a batch of %i calls at or below the limit", async (count) => {
    const { client, requests } = setup({ maxCallsInRequest: 3 });
    const jobs = Array.from({ length: count }, (_, index) =>
      client.api.Example.get({ value: String(index) }),
    );
    await Promise.all(jobs);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.methodCalls.map((call) => call[2])).toEqual(jobs.map((job) => job.id));
  });

  it("splits independent calls and resolves promises in original order", async () => {
    const { client, requests } = setup({ maxCallsInRequest: 2 });
    const jobs = ["a", "b", "c", "d", "e"].map((value) => client.api.Example.get({ value }));
    expect(await Promise.all(jobs)).toEqual(["a", "b", "c", "d", "e"].map((value) => ({ value })));
    expect(values(requests)).toEqual([
      [{ value: "a" }, { value: "b" }],
      [{ value: "c" }, { value: "d" }],
      [{ value: "e" }],
    ]);
    expect(requests.every((request) => request.using.includes(example.urn))).toBe(true);
  });

  it("keeps chains and multiple independent groups in their own requests", async () => {
    const { client, requests } = setup({ maxCallsInRequest: 2 });
    const a = client.api.Example.get({ value: "a" });
    const b = client.api.Example.get({ value: ref(a, "/value") });
    const c = client.api.Example.get({ value: "c" });
    const d = client.api.Example.get({ value: ref(c, "/value") });
    await Promise.all([a, b, c, d]);
    expect(requests.map((request) => request.methodCalls.map((call) => call[2]))).toEqual([
      [a.id, b.id],
      [c.id, d.id],
    ]);
    expect(requests[0]?.methodCalls[1]?.[1]).toEqual({
      "#value": { name: a.method, resultOf: a.id, path: "/value" },
    });
  });

  it("rejects only an oversized chain and sends unrelated calls", async () => {
    const { client, requests } = setup({ maxCallsInRequest: 2 });
    const a = client.api.Example.get({ value: "a" });
    const other = client.api.Example.get({ value: "other" });
    const b = client.api.Example.get({ value: ref(a, "/value") });
    const c = client.api.Example.get({ value: ref(b, "/value") });
    const results = await Promise.allSettled([a, b, c]);
    for (const result of results) {
      expect(result).toMatchObject({
        status: "rejected",
        reason: {
          kind: "request-limit",
          limit: "maxCallsInRequest",
          maximum: 2,
          actual: 3,
          methodCallIds: [a.id, b.id, c.id],
        },
      });
      expect(result).toMatchObject({ reason: expect.any(JmapRequestLimitError) });
    }
    await expect(other).resolves.toEqual({ value: "other" });
    expect(requests[0]?.methodCalls.map((call) => call[2])).toEqual([other.id]);
  });

  it("keeps result references introduced as wire arguments by middleware together", async () => {
    let sourceId = "";
    const { client, requests } = setup({ maxCallsInRequest: 2 }, undefined, [
      (payload) => {
        if (
          typeof payload === "object" &&
          payload !== null &&
          !Array.isArray(payload) &&
          "value" in payload &&
          payload.value === "dependent"
        ) {
          const sharedReference = { name: "Example/get", resultOf: sourceId, path: "/value" };
          return { ordinary: sharedReference, "#value": sharedReference };
        }
        return payload;
      },
    ]);
    const a = client.api.Example.get({ value: "a" });
    sourceId = a.id;
    const b = client.api.Example.get({ value: "dependent" });
    const c = client.api.Example.get({ value: "c" });
    await Promise.all([a, b, c]);
    expect(requests.map((request) => request.methodCalls.map((call) => call[2]))).toEqual([
      [a.id, b.id],
      [c.id],
    ]);
  });

  it("does not treat ordinary reference-shaped arguments as dependencies", async () => {
    let sourceId = "";
    const { client, requests } = setup({ maxCallsInRequest: 1 }, undefined, [
      (payload) => {
        if (
          typeof payload === "object" &&
          payload !== null &&
          "value" in payload &&
          payload.value === "ordinary"
        ) {
          return { value: { name: "Example/get", resultOf: sourceId, path: "/value" } };
        }
        return payload;
      },
    ]);
    const a = client.api.Example.get({ value: "a" });
    sourceId = a.id;
    const b = client.api.Example.get({ value: "ordinary" });
    await Promise.all([a, b]);
    expect(requests.map((request) => request.methodCalls.map((call) => call[2]))).toEqual([
      [a.id],
      [b.id],
    ]);
  });

  it("preserves interleaved dependency order", async () => {
    const { client, requests } = setup({ maxCallsInRequest: 3 });
    const a = client.api.Example.get({ value: "a" });
    const b = client.api.Example.get({ value: "b" });
    const c = client.api.Example.get({ value: ref(a, "/value") });
    const d = client.api.Example.get({ value: "d" });
    await Promise.all([a, b, c, d]);
    expect(requests.map((request) => request.methodCalls.map((call) => call[2]))).toEqual([
      [a.id, b.id, c.id],
      [d.id],
    ]);
  });

  it("rejects an interleaved block that cannot fit without reordering", async () => {
    const { client, requests } = setup({ maxCallsInRequest: 2 });
    const a = client.api.Example.get({ value: "a" });
    const b = client.api.Example.get({ value: "b" });
    const c = client.api.Example.get({ value: ref(a, "/value") });
    const results = await Promise.allSettled([a, b, c]);
    expect(results.every((result) => result.status === "rejected")).toBe(true);
    expect(requests).toHaveLength(0);
  });

  it("isolates failures to the split request that failed", async () => {
    const { client, requests } = setup({ maxCallsInRequest: 1 }, (request) =>
      requests.length === 1 ? Response.json({ error: "failed" }, { status: 503 }) : reply(request),
    );
    const a = client.api.Example.get({ value: "a" });
    const b = client.api.Example.get({ value: "b" });
    const results = await Promise.allSettled([a, b]);
    expect(results[0]).toMatchObject({ status: "rejected", reason: { kind: "http", status: 503 } });
    expect(results[1]).toEqual({ status: "fulfilled", value: { value: "b" } });
    expect(requests).toHaveLength(2);
  });

  it("counts UTF8 bytes for the entire serialized request", async () => {
    const { client, requests } = setup({ maxSizeRequest: 270 });
    const a = client.api.Example.get({ value: "é".repeat(15) });
    const b = client.api.Example.get({ value: "é".repeat(15) });
    await Promise.all([a, b]);
    expect(requests).toHaveLength(2);
    for (const request of requests)
      expect(new TextEncoder().encode(JSON.stringify(request)).length).toBeLessThanOrEqual(270);
  });

  it("accepts a request exactly at the byte limit", async () => {
    const baseline = setup({});
    await baseline.client.api.Example.get({ value: "a" });
    const maximum = new TextEncoder().encode(JSON.stringify(baseline.requests[0])).length;
    const { client, requests } = setup({ maxSizeRequest: maximum });
    await expect(client.api.Example.get({ value: "a" })).resolves.toEqual({ value: "a" });
    expect(new TextEncoder().encode(JSON.stringify(requests[0])).length).toBe(maximum);
  });

  it("rejects oversized payloads locally", async () => {
    const { client, requests } = setup({ maxSizeRequest: 50 });
    await expect(client.api.Example.get({ value: "a" })).rejects.toMatchObject({
      limit: "maxSizeRequest",
      maximum: 50,
    });
    expect(requests).toHaveLength(0);
  });

  it("limits concurrent API requests across scheduling windows and releases failed slots", async () => {
    const first = Promise.withResolvers<Response>();
    const started = Promise.withResolvers<void>();
    const { client, requests } = setup(
      { maxCallsInRequest: 1, maxConcurrentRequests: 1 },
      (request) => {
        if (requests.length === 1) {
          started.resolve();
          return first.promise;
        }
        return reply(request);
      },
    );
    const a = client.api.Example.get({ value: "a" });
    const settled = Promise.allSettled([a]);
    await started.promise;
    const b = client.api.Example.get({ value: "b" });
    await Promise.resolve();
    await Promise.resolve();
    expect(requests).toHaveLength(1);
    first.reject(new Error("connection failed"));
    await settled;
    await expect(b).resolves.toEqual({ value: "b" });
    expect(requests).toHaveLength(2);
  });

  it("rejects locally when the server allows no concurrent API requests", async () => {
    const { client, requests } = setup({ maxConcurrentRequests: 0 });
    await expect(client.api.Example.get({ value: "a" })).rejects.toMatchObject({
      kind: "request-limit",
      limit: "maxConcurrentRequests",
      maximum: 0,
      actual: 1,
    });
    expect(requests).toHaveLength(0);
  });

  it.each([-1, 1.5, Infinity])(
    "rejects invalid concurrency limit %s instead of hanging",
    async (maximum) => {
      const { client, requests } = setup({ maxConcurrentRequests: maximum });
      await expect(client.api.Example.get({ value: "a" })).rejects.toMatchObject({
        kind: "protocol",
      });
      expect(requests).toHaveLength(0);
    },
  );

  it("uses updated limits after refreshing the session", async () => {
    const limits = { maxCallsInRequest: 3 };
    const { client, requests } = setup(limits);
    await client.session;
    limits.maxCallsInRequest = 1;
    await client.refreshSession();
    await Promise.all([
      client.api.Example.get({ value: "a" }),
      client.api.Example.get({ value: "b" }),
    ]);
    expect(requests).toHaveLength(2);
  });
});
