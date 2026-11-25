/* oxlint-disable unicorn/require-post-message-target-origin -- workers take no target origin */
import type { CompileOutput } from "./compile.ts";
import type { SourceInfo } from "./instrument.ts";
import type { Connection, Diagnostic, RunEvent, RunRequest } from "./protocol.ts";

/**
 * What a runner reports about the latest run. Events of a run that a newer
 * run replaced are dropped.
 */
export type RunnerEvent =
  | { type: "start" }
  | { type: "diagnostics"; diagnostics: Diagnostic[] }
  /** The code compiled; where its instrumented locations are */
  | { type: "compiled"; source: SourceInfo }
  | RunEvent;

export interface Runner {
  /** Run this code, replacing any earlier run, against a connected server if given */
  run(source: string, connection?: Connection): void;
  /** Stop the current run, ending its requests */
  stop(): void;
}

/**
 * Run user code: compile it with `compile`, then run each version in a fresh
 * worker, so stopping a run is as simple as terminating its worker
 */
export function createRunner(
  compile: (source: string) => Promise<CompileOutput>,
  onEvent: (event: RunnerEvent) => void,
): Runner {
  let current: Worker | undefined;
  let latest = 0;

  function stop() {
    current?.terminate();
    current = undefined;
  }

  return {
    stop() {
      // Also drops a run that is still compiling
      latest++;
      stop();
    },
    async run(source, connection) {
      const id = ++latest;
      stop();
      onEvent({ type: "start" });
      const result = await compile(source);
      if (id !== latest) {
        return;
      }
      if ("diagnostics" in result) {
        onEvent({ type: "diagnostics", diagnostics: result.diagnostics });
        return;
      }
      onEvent({ type: "compiled", source: result.source });
      const worker = new Worker(new URL("./run.worker.ts", import.meta.url), { type: "module" });
      current = worker;
      worker.addEventListener("message", ({ data }: MessageEvent<RunEvent>) => {
        if (id === latest) {
          onEvent(data);
        }
      });
      worker.addEventListener("error", (event) => {
        if (id === latest) {
          onEvent({ type: "error", message: event.message || "The run failed" });
        }
      });
      worker.postMessage({ code: result.code, connection } satisfies RunRequest);
    },
  };
}
