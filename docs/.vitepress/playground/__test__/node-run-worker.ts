/* oxlint-disable typescript/no-unsafe-type-assertion, unicorn/require-post-message-target-origin */
import { parentPort, workerData } from "node:worker_threads";

import type { RunEvent } from "../protocol.ts";
import { run } from "../run.ts";

/**
 * Runs compiled code as the run worker does, in a Node worker thread, so
 * tests use Node's own `import()`. Warnings are posted too, as
 * `{ type: "warn" }`.
 */
export type NodeRunMessage = RunEvent | { type: "warn"; message: string };

const post = (message: NodeRunMessage) => parentPort?.postMessage(message);

console.warn = (...args: unknown[]) => post({ type: "warn", message: args.map(String).join(" ") });
process.on("uncaughtException", (error) => post({ type: "error", message: String(error) }));

run((workerData as { code: string }).code, post);
