import { describe, expect, test, vi } from "vitest";

import { Batcher } from "../batcher";

vi.useFakeTimers();

describe("Batcher", () => {
  test("flushes inputs enqueued in the same turn together", async () => {
    const receivedBatches: string[][] = [];
    const batcher = new Batcher<string>((work) => {
      receivedBatches.push(work.map(({ input }) => input));
    });

    void batcher.enqueue("first");
    void batcher.enqueue("second");

    await vi.advanceTimersToNextTimerAsync();

    expect(receivedBatches).toEqual([["first", "second"]]);
  });

  test("returns an input-shaped promise for enqueued work", async () => {
    const batcher = new Batcher<{ id: string }>((work) => {
      work[0]?.handle.resolve("completed");
    });

    const result = batcher.enqueue<string>({ id: "request-1" });

    expect(result.id).toBe("request-1");
    await expect(result).resolves.toBe("completed");
  });

  test("resolves enqueued work after an asynchronous flush", async () => {
    const batcher = new Batcher<string>(async (work) => {
      work[0]?.handle.resolve("completed");
    });

    const result = batcher.enqueue<string>("request-1");

    await vi.advanceTimersToNextTimerAsync();

    await expect(result).resolves.toBe("completed");
  });

  test("flushes work enqueued during a flush in a later batch", async () => {
    const receivedBatches: string[][] = [];
    const batcher = new Batcher<string>((work) => {
      receivedBatches.push(work.map(({ input }) => input));

      if (work[0]?.input === "first") {
        void batcher.enqueue("second");
      }
    });

    void batcher.enqueue("first");

    await vi.advanceTimersToNextTimerAsync();

    expect(receivedBatches).toEqual([["first"], ["second"]]);
  });
});
