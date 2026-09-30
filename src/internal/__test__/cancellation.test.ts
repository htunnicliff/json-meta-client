import { describe, expect, it, vi } from "vitest";

import { JmapAbortError } from "../../error.ts";
import { Batch } from "../batch.ts";

describe("batch cancellation", () => {
  it("rejects immediately with a pre-aborted signal", async () => {
    const reason = new Error("stop");
    const batch = new Batch<string>(() => {});
    const pending = batch.enqueue("job", AbortSignal.abort(reason));
    await expect(pending).rejects.toMatchObject({
      name: "AbortError",
      kind: "abort",
      reason,
      cause: reason,
    });
    await expect(pending).rejects.toBeInstanceOf(JmapAbortError);
  });

  it("rejects promptly while an asynchronous flush is pending", async () => {
    const release = Promise.withResolvers<void>();
    const batch = new Batch<string>(async (jobs) => {
      await release.promise;
      for (const { handle } of jobs) handle.resolve("done");
    });
    const controller = new AbortController();
    const canceled = batch.enqueue("first", controller.signal);
    const sibling = batch.enqueue("second");
    const rejected = canceled.catch((error: unknown) => error);
    await Promise.resolve();
    controller.abort();
    expect(await rejected).toBeInstanceOf(JmapAbortError);
    release.resolve();
    await expect(sibling).resolves.toBe("done");
  });

  it("cleans listeners when jobs settle and ignores later cancellation", async () => {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    const batch = new Batch<string>((jobs) => jobs[0]?.handle.resolve("done"));
    const pending = batch.enqueue("first", controller.signal);
    await expect(pending).resolves.toBe("done");
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
    controller.abort();
    await expect(pending).resolves.toBe("done");
  });
});
