import { describe, expect, test, vi } from "vitest";

import { Batch } from "../batch.ts";

vi.useFakeTimers();

describe(Batch, () => {
  test("flushes inputs enqueued in the same turn together", async () => {
    const receivedBatches: string[][] = [];
    const batcher = new Batch<string>((jobs) => {
      receivedBatches.push(jobs.map(({ payload }) => payload));
    });

    void batcher.enqueue("first");
    void batcher.enqueue("second");

    await vi.advanceTimersToNextTimerAsync();

    expect(receivedBatches).toEqual([["first", "second"]]);
  });

  test("returns an input-shaped promise for enqueued job", async () => {
    const batcher = new Batch<{ id: string }>((jobs) => {
      jobs[0]?.handle.resolve("completed");
    });

    const result = batcher.enqueue<string>({ id: "request-1" });

    expect(result.id).toBe("request-1");
    await expect(result).resolves.toBe("completed");
  });

  test("resolves enqueued job after an asynchronous flush", async () => {
    const batcher = new Batch<string>(async (jobs) => {
      jobs[0]?.handle.resolve("completed");
    });

    const result = batcher.enqueue<string>("request-1");

    await vi.advanceTimersToNextTimerAsync();

    await expect(result).resolves.toBe("completed");
  });

  test("flushes job enqueued during a flush in a later batch", async () => {
    const receivedBatches: string[][] = [];
    const batcher = new Batch<string>((jobs) => {
      receivedBatches.push(jobs.map(({ payload }) => payload));

      if (jobs[0]?.payload === "first") {
        void batcher.enqueue("second");
      }
    });

    void batcher.enqueue("first");

    await vi.advanceTimersToNextTimerAsync();

    expect(receivedBatches).toEqual([["first"], ["second"]]);
  });

  test.each(["throw", "reject"])(
    "rejects every pending job when processing fails by %s",
    async (failure) => {
      const error = new Error("Processing failed");
      const batcher = new Batch<string>(() => {
        if (failure === "throw") throw error;
        return Promise.reject(error);
      });
      const first = batcher.enqueue("first");
      const second = batcher.enqueue("second");
      const settled = Promise.allSettled([first, second]);
      await vi.advanceTimersToNextTimerAsync();
      await expect(settled).resolves.toEqual([
        { status: "rejected", reason: error },
        { status: "rejected", reason: error },
      ]);
    },
  );

  test("preserves settled results and rejects only pending jobs after a processing failure", async () => {
    const error = new Error("Processing failed");
    const batcher = new Batch<string>((jobs) => {
      jobs[0]?.handle.resolve("completed");
      throw error;
    });
    const settled = Promise.allSettled([batcher.enqueue("first"), batcher.enqueue("second")]);
    await vi.advanceTimersToNextTimerAsync();
    await expect(settled).resolves.toEqual([
      { status: "fulfilled", value: "completed" },
      { status: "rejected", reason: error },
    ]);
  });

  test("allows another batch to finish while an earlier flush is pending and later fails", async () => {
    const release = Promise.withResolvers<void>();
    const error = new Error("Processing failed");
    const receivedBatches: string[][] = [];
    const batcher = new Batch<string>(async (jobs) => {
      receivedBatches.push(jobs.map(({ payload }) => payload));
      if (jobs[0]?.payload === "first") {
        await release.promise;
        throw error;
      }
      jobs[0]?.handle.resolve("completed");
    });
    const first = batcher.enqueue("first");
    const firstSettled = Promise.allSettled([first]);
    await vi.advanceTimersToNextTimerAsync();
    const second = batcher.enqueue("second");
    await vi.advanceTimersToNextTimerAsync();
    await expect(second).resolves.toBe("completed");
    release.resolve();
    await expect(firstSettled).resolves.toEqual([{ status: "rejected", reason: error }]);
    const third = batcher.enqueue("third");
    await vi.advanceTimersToNextTimerAsync();
    await expect(third).resolves.toBe("completed");
    expect(receivedBatches).toEqual([["first"], ["second"], ["third"]]);
  });
});
