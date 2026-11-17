/* oxlint-disable typescript/no-unsafe-type-assertion, unicorn/require-post-message-target-origin */
import { parentPort, workerData } from "node:worker_threads";

import type { RunEvent } from "../protocol.ts";
import { run } from "../run.ts";

/**
 * Runs compiled code as the run worker does, in a Node worker thread, so
 * tests use Node's own `import()`.
 */
const post = (message: RunEvent) => parentPort?.postMessage(message);

process.on("uncaughtException", (error) => post({ type: "error", message: String(error) }));

run((workerData as { code: string }).code, post);
