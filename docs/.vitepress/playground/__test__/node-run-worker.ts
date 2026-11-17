/* oxlint-disable typescript/no-unsafe-type-assertion, unicorn/require-post-message-target-origin */
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { parentPort, workerData } from "node:worker_threads";

import { applyHookPatch, hookPatchFile } from "../hook-patch.ts";
import type { RunEvent } from "../protocol.ts";
import { run } from "../run.ts";

/**
 * Runs compiled code as the run worker does, in a Node worker thread, so
 * tests use Node's own `import()`.
 */
const post = (message: RunEvent) => parentPort?.postMessage(message);

process.on("uncaughtException", (error) => post({ type: "error", message: String(error) }));

// Use the same patched modules as Vite, only while loading this worker's client.
const loader = registerHooks({
  load(url, context, nextLoad) {
    const file = hookPatchFile(url);
    return file
      ? {
          format: "module-typescript",
          source: applyHookPatch(file, readFileSync(file, "utf8")),
          shortCircuit: true,
        }
      : nextLoad(url, context);
  },
});
const { JsonMetaClient } = await import("../../../../src/client.ts?playground-hooks").finally(
  () => {
    loader.deregister();
  },
);

run(JsonMetaClient, (workerData as { code: string }).code, post);
