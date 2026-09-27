import { describe, expect, test, vi } from "vitest";

import { Batch } from "../batch.ts";

vi.useFakeTimers();

describe("Batch", () => {
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
});
