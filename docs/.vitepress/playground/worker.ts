import type { RunnerMessage } from "./messages.ts";
import { startRun } from "./run.ts";

interface PlaygroundWorker {
  postMessage(message: RunnerMessage): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<{ code: string }>) => void,
  ): void;
}

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Workers expose this interface at runtime
const worker = self as unknown as PlaygroundWorker;
let started = false;

/**
 * The page starts a fresh worker for every run, so a worker only ever runs the
 * first code it receives. Terminating it is how a run ends: it stops pending
 * fetches, timers, and infinite loops together.
 */
worker.addEventListener("message", ({ data }) => {
  if (started) return;
  started = true;
  startRun({
    code: data.code,
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- workers have no target origin
    post: (message) => worker.postMessage(message),
  });
});
