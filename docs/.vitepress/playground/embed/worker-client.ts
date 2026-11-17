import * as Comlink from "comlink";

import type { EmbedWorker } from "./embed.worker.ts";

let worker: Comlink.Remote<EmbedWorker> | undefined;

/**
 * The worker every embed on the page shares, started on first use
 */
export function embedWorker(): Comlink.Remote<EmbedWorker> {
  if (!worker) {
    worker = Comlink.wrap<EmbedWorker>(
      new Worker(new URL("./embed.worker.ts", import.meta.url), { type: "module" }),
    );
    void worker.initialize();
  }
  return worker;
}
