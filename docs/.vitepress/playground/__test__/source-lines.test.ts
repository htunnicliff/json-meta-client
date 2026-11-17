import { Worker } from "node:worker_threads";

import { describe, expect, it } from "vitest";

import type { RecordedRequest } from "../../recorder/index.ts";
import { compile } from "../compile.ts";
import { examples } from "../examples.ts";
import type { RunEvent } from "../protocol.ts";
import { sourceLines } from "../source-lines.ts";
import { buildTimeline } from "../timeline.ts";
import type { TimelineCall } from "../timeline.ts";
import type { Trace } from "../tracer.ts";

/**
 * Run code in a worker thread until it is idle, and tie its trace to its source
 */
async function linesOf(code: string) {
  const output = compile(code);
  if ("diagnostics" in output) throw new Error(JSON.stringify(output.diagnostics));
  const worker = new Worker(new URL("node-run-worker.ts", import.meta.url), {
    workerData: { code: output.code },
  });
  try {
    const requests: RecordedRequest[] = [];
    const trace = await new Promise<Trace>((resolve, reject) => {
      let last: Trace | undefined;
      worker.on("error", reject);
      worker.on("message", (event: RunEvent) => {
        if (event.type === "request") requests[event.index] = event.request;
        if (event.type === "trace") last = event.trace;
        if (event.type === "idle") resolve(last!);
        if (event.type === "error") reject(new Error(event.message));
      });
    });
    const calls = buildTimeline(requests).flatMap((entry): TimelineCall[] =>
      entry.kind === "batch" ? entry.calls : [],
    );
    return { lines: sourceLines(output.source, trace, calls), calls, source: output.source };
  } finally {
    await worker.terminate();
  }
}

const lineOf = (range: { start: { line: number } }) => range.start.line;

describe(sourceLines, () => {
  it("reproduces the sequential awaits board", async () => {
    const { lines } = await linesOf(examples[1].code);

    expect(lines.calls).toEqual({
      "#1": expect.objectContaining({ start: { line: 9, column: 22 } }),
    });
    expect(lines.waiting).toEqual([
      expect.objectContaining({ count: 1, calls: [{ label: "#1", name: "Email/query" }] }),
    ]);
    expect(lineOf(lines.waiting[0].range)).toBe(9);
  });

  it("maps a multi-line call to its first line, not the result reference's", async () => {
    const { lines } = await linesOf(examples[0].code);

    expect(lineOf(lines.calls["#1"])).toBe(9);
    expect(lineOf(lines.calls["#2"])).toBe(14);
    expect(lines.waiting.map(({ range, calls }) => [lineOf(range), calls])).toEqual([
      [14, [{ label: "#2", name: "Email/get" }]],
    ]);
  });

  it("maps calls made in a helper, a callback and a loop to the helper's line", async () => {
    const { lines } = await linesOf(`
      function get(id: string) {
        return client.api.Mailbox.get({ ids: [id] });
      }
      void get("a");
      ["b", "c"].map((id) => get(id));
      for (const id of ["d"]) void get(id);
    `);

    expect(Object.values(lines.calls).map(lineOf)).toEqual([3, 3, 3, 3]);
  });

  it("counts awaits pending at one location, and reports distinct ones separately", async () => {
    const { lines } = await linesOf(`
      async function load(id: string) {
        return await client.api.Mailbox.get({ ids: [id] });
      }
      void load("a");
      void load("b");
      await Promise.all([load("c")]);
    `);

    expect(lines.waiting.map(({ range, count }) => [lineOf(range), count])).toEqual([
      [3, 3],
      [7, 1],
    ]);
  });

  it("clears an await once it settles", async () => {
    const { lines } = await linesOf(`
      await Promise.resolve(1);
      const value = await client.api.Mailbox.get({ ids: [String(await Promise.resolve(2))] });
    `);

    expect(lines.waiting.map(({ range }) => lineOf(range))).toEqual([3]);
  });
});
