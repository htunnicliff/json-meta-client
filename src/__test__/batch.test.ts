import type { Invocation, Response } from "jmap-rfc-types";
import { describe, expect, it, vi } from "vitest";

import { MethodCallBatcher, type ResolveUrnsForMethodCallFn, type TransportFn } from "../batch.ts";
import { JmapError } from "../error.ts";

/** Construct a properly typed JMAP {@link Invocation} tuple. */
function inv(name: string, args: unknown, id: string): Invocation {
  return [name, args, id];
}

/** Build a JMAP Response echoing back a result for each method call id. */
function respondWith(...responses: Invocation[]): Response {
  return { methodResponses: responses, sessionState: "state-1" };
}

/** A transport that echoes each call back keyed by its method call id. */
const echoTransport: TransportFn = async (calls) =>
  respondWith(...calls.map(([name, , id]) => inv(name, { id }, id)));

/** Requires the mail urn for Email methods, core otherwise. */
const mailAwareResolveUsing: ResolveUrnsForMethodCallFn = (method) =>
  method.startsWith("Email")
    ? ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"]
    : ["urn:ietf:params:jmap:core"];

function makeBatcher(options?: {
  transport?: TransportFn;
  resolveUsing?: ResolveUrnsForMethodCallFn;
}) {
  const transport = options?.transport ?? echoTransport;
  const resolveUsing = options?.resolveUsing ?? (() => ["urn:ietf:params:jmap:core"]);
  return { batcher: new MethodCallBatcher({ transport, resolveUsing }), transport };
}

describe("Batcher.enqueue", () => {
  it("coalesces calls made in the same microtask into one request", async () => {
    const transport = vi.fn(echoTransport);
    const { batcher } = makeBatcher({ transport });

    const [a, b, c] = await Promise.all([
      batcher.enqueue("Foo/get", { n: 1 }, "c0"),
      batcher.enqueue("Foo/get", { n: 2 }, "c1"),
      batcher.enqueue("Foo/get", { n: 3 }),
    ]);

    expect(transport).toHaveBeenCalledTimes(1);
    expect(a).toEqual({ id: "c0" });
    expect(b).toEqual({ id: "c1" });
    expect(c).toEqual({ id: expect.stringMatching("Foo/get::") });
  });

  it("assigns sequential method call ids and forwards the invocation", async () => {
    const transport = vi.fn(echoTransport);
    const { batcher } = makeBatcher({ transport });

    await Promise.all([
      batcher.enqueue("Email/get", { a: 1 }, "c0"),
      batcher.enqueue("Email/set", { b: 2 }, "c1"),
    ]);

    const sentCalls = transport.mock.calls[0][0];
    expect(sentCalls).toEqual([
      ["Email/get", { a: 1 }, "c0"],
      ["Email/set", { b: 2 }, "c1"],
    ]);
  });

  it("separates calls made in different microtasks into different requests", async () => {
    const transport = vi.fn(echoTransport);
    const { batcher } = makeBatcher({ transport });

    await batcher.enqueue("Foo/get", {});
    await batcher.enqueue("Foo/get", {});

    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("collects the union of required capability urns into `using`", async () => {
    const transport = vi.fn(echoTransport);
    const { batcher } = makeBatcher({
      transport,
      resolveUsing: mailAwareResolveUsing,
    });

    await Promise.all([batcher.enqueue("Email/get", {}), batcher.enqueue("Core/echo", {})]);

    const using = transport.mock.calls[0][1];
    expect([...using].toSorted()).toEqual([
      "urn:ietf:params:jmap:core",
      "urn:ietf:params:jmap:mail",
    ]);
  });

  it("routes each response back to its originating call by id", async () => {
    // Return responses out of order to prove routing is by id, not position.
    const transport: TransportFn = async () =>
      respondWith(
        inv("Foo/get", { which: "second" }, "c1"),
        inv("Foo/get", { which: "first" }, "c0"),
      );
    const { batcher } = makeBatcher({ transport });

    const [first, second] = await Promise.all([
      batcher.enqueue("Foo/get", {}),
      batcher.enqueue("Foo/get", {}),
    ]);

    expect(first).toEqual({ which: "first" });
    expect(second).toEqual({ which: "second" });
  });

  it("rejects a call that has no matching response", async () => {
    const transport: TransportFn = async () => respondWith();
    const { batcher } = makeBatcher({ transport });

    await expect(batcher.enqueue("Foo/get", {})).rejects.toThrow(
      'No response for method call "c0"',
    );
  });

  it("rejects every queued call when the transport throws", async () => {
    const failure = new Error("network down");
    const transport: TransportFn = async () => {
      throw failure;
    };
    const { batcher } = makeBatcher({ transport });

    const a = batcher.enqueue("Foo/get", {});
    const b = batcher.enqueue("Foo/get", {});

    await expect(a).rejects.toBe(failure);
    await expect(b).rejects.toBe(failure);
  });

  it("rejects with a JmapError on a method-level error response", async () => {
    const problem = { type: "urn:ietf:params:jmap:error:invalidArguments" };
    const transport: TransportFn = async () => respondWith(inv("error", problem, "c0"));
    const { batcher } = makeBatcher({ transport });

    await expect(batcher.enqueue("Foo/get", {})).rejects.toBeInstanceOf(JmapError);
  });

  it("resolves when a response is named `error` but is not problem details", async () => {
    // name === "error" but args are not problem details -> resolved, not rejected.
    const transport: TransportFn = async () =>
      respondWith(inv("error", { not: "problemDetails" }, "c0"));
    const { batcher } = makeBatcher({ transport });

    await expect(batcher.enqueue("Foo/get", {})).resolves.toEqual({
      not: "problemDetails",
    });
  });
});
