/* oxlint-disable unicorn/require-post-message-target-origin */
import type { RunEvent, RunRequest } from "./protocol.ts";
import { describeError, run } from "./run.ts";

/**
 * Runs one version of the user's code. The page terminates this worker before
 * the next run, which also ends its pending requests and any infinite loop.
 */
const post = (event: RunEvent) => self.postMessage(event);

self.addEventListener("error", (event) => {
  event.preventDefault();
  post({ type: "error", message: describeError(event.error ?? event.message) });
});
self.addEventListener("unhandledrejection", (event) => {
  event.preventDefault();
  post({ type: "error", message: describeError(event.reason) });
});

self.addEventListener("message", ({ data }: MessageEvent<RunRequest>) => run(data.code, post), {
  once: true,
});
