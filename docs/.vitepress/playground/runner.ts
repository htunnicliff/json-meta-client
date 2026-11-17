/* oxlint-disable unicorn/require-post-message-target-origin -- workers take no target origin */
import type {
  CompileRequest,
  CompileResult,
  Diagnostic,
  RunEvent,
  RunRequest,
} from "./protocol.ts";

/**
 * What a runner reports about the latest run. Events of a run that a newer
 * run replaced are dropped.
 */
export type RunnerEvent =
  | { type: "start" }
  | { type: "diagnostics"; diagnostics: Diagnostic[] }
  | RunEvent;

export interface Runner {
  /** Run this code, replacing any earlier run */
  run(source: string): void;
  /** Stop the current run and the compiler */
  dispose(): void;
}

/**
 * Run user code in workers: a long-lived one compiles it, and a fresh one runs
 * each version, so stopping a run is as simple as terminating its worker.
 */
export function createRunner(onEvent: (event: RunnerEvent) => void): Runner {
  let compiler: Worker | undefined;
  let current: Worker | undefined;
  let latest = 0;

  const compiled = new Map<number, (result: CompileResult) => void>();
  function compile(source: string, id: number): Promise<CompileResult> {
    if (!compiler) {
      compiler = new Worker(new URL("./compile.worker.ts", import.meta.url), { type: "module" });
      compiler.addEventListener("message", ({ data }: MessageEvent<CompileResult>) => {
        compiled.get(data.id)?.(data);
        compiled.delete(data.id);
      });
    }
    const worker = compiler;
    return new Promise((resolve) => {
      compiled.set(id, resolve);
      worker.postMessage({ id, source } satisfies CompileRequest);
    });
  }

  function stop() {
    current?.terminate();
    current = undefined;
  }

  return {
    async run(source) {
      const id = ++latest;
      stop();
      onEvent({ type: "start" });
      const result = await compile(source, id);
      if (id !== latest) return;
      if ("diagnostics" in result) {
        onEvent({ type: "diagnostics", diagnostics: result.diagnostics });
        return;
      }
      const worker = new Worker(new URL("./run.worker.ts", import.meta.url), { type: "module" });
      current = worker;
      worker.addEventListener("message", ({ data }: MessageEvent<RunEvent>) => {
        if (id === latest) onEvent(data);
      });
      worker.addEventListener("error", (event) => {
        if (id === latest) onEvent({ type: "error", message: event.message || "The run failed" });
      });
      worker.postMessage({ code: result.code } satisfies RunRequest);
    },
    dispose() {
      latest++;
      stop();
      compiler?.terminate();
      compiler = undefined;
    },
  };
}
