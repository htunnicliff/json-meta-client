import * as Comlink from "comlink";

import type { TypeScriptWorker } from "./ts.worker.ts";

/**
 * Start the playground's TypeScript worker
 */
export function startTypeScriptWorker(): Comlink.Remote<TypeScriptWorker> {
  const worker = Comlink.wrap<TypeScriptWorker>(
    new Worker(new URL("./ts.worker.ts", import.meta.url), { type: "module" }),
  );
  void worker.initialize();
  return worker;
}
