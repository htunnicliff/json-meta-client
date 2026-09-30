import { afterEach, describe, expect, it, vi } from "vitest";

import { core } from "../capabilities/core.ts";
import { mail } from "../capabilities/mail.ts";
import { Client } from "../client.ts";
import { JmapAbortError } from "../error.ts";
import { ref } from "../ref.ts";

const session = {
  apiUrl: "https://example.test/api",
  capabilities: { [mail.urn]: {} },
  primaryAccounts: { [mail.urn]: "a" },
  uploadUrl: "https://example.test/upload/{accountId}",
  downloadUrl: "https://example.test/download/{accountId}/{blobId}/{name}?type={type}",
};

function createClient() {
  return new Client({
    bearerToken: "token",
    sessionUrl: "https://example.test/session",
    capabilities: [mail],
  });
}

function setup() {
  const requests: { using: string[]; methodCalls: [string, object, string][] }[] = [];
  const started = Promise.withResolvers<AbortSignal>();
  const complete = Promise.withResolvers<Response>();
  const fetch = vi.fn<typeof globalThis.fetch>(async (url, init) => {
    if (
      (typeof url === "string" ? url : url instanceof URL ? url.href : url.url).endsWith("/session")
    )
      return Response.json(session);
    if (typeof init?.body !== "string") throw new Error("Expected serialized request");
    requests.push(JSON.parse(init.body));
    if (!init.signal) throw new Error("Expected request signal");
    started.resolve(init.signal);
    init.signal.addEventListener("abort", () => complete.reject(init.signal?.reason), {
      once: true,
    });
    return complete.promise;
  });
  vi.stubGlobal("fetch", fetch);
  const finish = () =>
    complete.resolve(
      Response.json({
        methodResponses: requests[0]!.methodCalls.map(([name, , id]) => [name, { ids: [id] }, id]),
      }),
    );
  return { requests, fetch, started, finish };
}

afterEach(() => vi.unstubAllGlobals());

describe("client cancellation", () => {
  it("rejects pre-aborted calls without middleware or network work", async () => {
    const { fetch } = setup();
    const middleware = vi.fn<import("../internal/types.ts").Middleware>((args) => args);
    const instance = new Client({
      bearerToken: "token",
      sessionUrl: "https://example.test/session",
      capabilities: [mail],
      middleware: [middleware],
    });
    const reason = new Error("stop");
    await expect(
      instance.api.Email.query({}, { signal: AbortSignal.abort(reason) }),
    ).rejects.toMatchObject({ name: "AbortError", cause: reason });
    await Promise.resolve();
    expect(middleware).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("removes canceled pending calls and leaves their siblings intact", async () => {
    const { requests, started, finish } = setup();
    const instance = createClient();
    const controller = new AbortController();
    const canceled = instance.api.Email.query({}, { signal: controller.signal });
    const sibling = instance.api.Email.query({ limit: 1 });
    const rejection = canceled.catch((error: unknown) => error);
    controller.abort("stop");
    expect(await rejection).toBeInstanceOf(JmapAbortError);
    await started.promise;
    expect(requests[0]!.methodCalls.map((call) => call[2])).toEqual([sibling.id]);
    expect(requests[0]!.methodCalls[0]![1]).not.toHaveProperty("signal");
    finish();
    await expect(sibling).resolves.toEqual({ ids: [sibling.id] });
  });

  it("rejects a canceled in-flight call promptly without aborting siblings", async () => {
    const { started, finish } = setup();
    const controller = new AbortController();
    const instance = createClient();
    const canceled = instance.api.Email.query({}, { signal: controller.signal });
    const sibling = instance.api.Email.query({ limit: 1 });
    const rejection = canceled.catch((error: unknown) => error);
    const signal = await started.promise;
    controller.abort("reason");
    expect(await rejection).toBeInstanceOf(JmapAbortError);
    expect(signal.aborted).toBe(false);
    finish();
    await expect(sibling).resolves.toEqual({ ids: [sibling.id] });
  });

  it("aborts shared transport when every logical call is canceled", async () => {
    const { started } = setup();
    const instance = createClient();
    const first = new AbortController();
    const second = new AbortController();
    const calls = [
      instance.api.Email.query({}, { signal: first.signal }),
      instance.api.Email.query({}, { signal: second.signal }),
    ];
    const settled = Promise.allSettled(calls);
    const signal = await started.promise;
    first.abort();
    expect(signal.aborted).toBe(false);
    second.abort();
    expect(signal.aborted).toBe(true);
    const results = await settled;
    expect(
      results.every(
        (result) => result.status === "rejected" && result.reason instanceof JmapAbortError,
      ),
    ).toBe(true);
  });

  it("rejects dependencies when a source is canceled before sending", async () => {
    const { requests, started, finish } = setup();
    const instance = createClient();
    const controller = new AbortController();
    const source = instance.api.Email.query({}, { signal: controller.signal });
    const dependent = instance.api.Email.get({ ids: ref(source, "/ids") });
    const sibling = instance.api.Email.query({ limit: 1 });
    const rejected = Promise.allSettled([source, dependent]);
    controller.abort("source canceled");
    await started.promise;
    expect(requests[0]!.methodCalls.map((call) => call[2])).toEqual([sibling.id]);
    finish();
    expect(
      (await rejected).every(
        (result) => result.status === "rejected" && result.reason instanceof JmapAbortError,
      ),
    ).toBe(true);
    await expect(sibling).resolves.toEqual({ ids: [sibling.id] });
  });

  it("retains an in-flight canceled source so server references remain valid", async () => {
    const { requests, started, finish } = setup();
    const instance = createClient();
    const controller = new AbortController();
    const source = instance.api.Email.query({}, { signal: controller.signal });
    const dependent = instance.api.Email.get({ ids: ref(source, "/ids") });
    const rejected = source.catch((error: unknown) => error);
    const signal = await started.promise;
    controller.abort();
    expect(await rejected).toBeInstanceOf(JmapAbortError);
    expect(signal.aborted).toBe(false);
    expect(requests[0]!.methodCalls).toHaveLength(2);
    finish();
    await expect(dependent).resolves.toEqual({ ids: [dependent.id] });
  });
  it("cancels discovery waiters promptly while preserving shared discovery", async () => {
    const discovery = Promise.withResolvers<Response>();
    const fetch = vi.fn<typeof globalThis.fetch>().mockReturnValue(discovery.promise);
    vi.stubGlobal("fetch", fetch);
    const instance = createClient();
    const controller = new AbortController();
    const pending = instance.api.Email.query({}, { signal: controller.signal });
    const rejected = pending.catch((error: unknown) => error);
    await Promise.resolve();
    const sharedSession = instance.session;
    controller.abort("stop discovery wait");
    expect(await rejected).toMatchObject({ cause: "stop discovery wait" });
    discovery.resolve(Response.json(session));
    await expect(sharedSession).resolves.toEqual(session);
    await Promise.resolve();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("removes a canceled semaphore waiter and releases capacity for later work", async () => {
    const firstResponse = Promise.withResolvers<Response>();
    const firstStarted = Promise.withResolvers<void>();
    const requests: { methodCalls: [string, object, string][] }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof globalThis.fetch>(async (url, init) => {
        if (typeof url === "string" && url.endsWith("/session"))
          return Response.json({
            ...session,
            capabilities: { ...session.capabilities, [core.urn]: { maxConcurrentRequests: 1 } },
          });
        const request = JSON.parse(typeof init?.body === "string" ? init.body : "{}");
        requests.push(request);
        if (requests.length === 1) {
          firstStarted.resolve();
          return firstResponse.promise;
        }
        return Response.json({
          methodResponses: request.methodCalls.map(([name, , id]: [string, object, string]) => [
            name,
            {},
            id,
          ]),
        });
      }),
    );
    const instance = createClient();
    const first = instance.api.Email.query({});
    await firstStarted.promise;
    const controller = new AbortController();
    const queued = instance.api.Email.query({}, { signal: controller.signal });
    const rejected = queued.catch((error: unknown) => error);
    await Promise.resolve();
    await Promise.resolve();
    controller.abort();
    expect(await rejected).toBeInstanceOf(JmapAbortError);
    firstResponse.resolve(Response.json({ methodResponses: [["Email/query", {}, first.id]] }));
    await first;
    const later = instance.api.Email.query({});
    await expect(later).resolves.toEqual({});
    expect(requests).toHaveLength(2);
    expect(requests.flatMap((request) => request.methodCalls.map((call) => call[2]))).not.toContain(
      queued.id,
    );
  });

  it.each(["upload", "download"] as const)(
    "cancels blob %s and passes its signal to fetch",
    async (operation) => {
      const started = Promise.withResolvers<AbortSignal>();
      vi.stubGlobal(
        "fetch",
        vi.fn<typeof globalThis.fetch>(async (url, init) => {
          if (typeof url === "string" && url.endsWith("/session")) return Response.json(session);
          if (!init?.signal) throw new Error("Expected blob signal");
          started.resolve(init.signal);
          return new Promise<Response>(() => {});
        }),
      );
      const instance = createClient();
      const controller = new AbortController();
      const pending =
        operation === "upload"
          ? instance.blob.upload("body", {}, { signal: controller.signal })
          : instance.blob.download(
              { blobId: "b", name: "n", type: "text/plain" },
              { signal: controller.signal },
            );
      const rejected = pending.catch((error: unknown) => error);
      expect(await started.promise).toBe(controller.signal);
      controller.abort("blob canceled");
      expect(await rejected).toMatchObject({ kind: "abort", cause: "blob canceled" });
    },
  );

  it("rejects pre-aborted state change subscriptions before fetching", async () => {
    const { fetch } = setup();
    await expect(
      createClient().onStateChange(() => {}, { signal: AbortSignal.abort("stop") }),
    ).rejects.toMatchObject({ name: "AbortError", cause: "stop" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not abort completed transport when a settled call is canceled", async () => {
    const { started, finish } = setup();
    const controller = new AbortController();
    const pending = createClient().api.Email.query({}, { signal: controller.signal });
    const signal = await started.promise;
    finish();
    await pending;
    controller.abort();
    expect(signal.aborted).toBe(false);
  });
});
