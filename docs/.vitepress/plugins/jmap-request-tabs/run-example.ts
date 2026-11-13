/* oxlint-disable no-await-in-loop, typescript/no-unsafe-type-assertion, unicorn/require-post-message-target-origin */
import { parentPort, workerData } from "node:worker_threads";

import { docsClientOptions } from "../../../../scripts/docs-client-options.ts";
import { JsonMetaClient } from "../../../../src/index.ts";
import { recordingFetch, seedCallIds } from "../../recorder/index.ts";

/**
 * Runs one documentation example in a worker thread, with a placeholder
 * Session and a pending `fetch`, and posts back the JMAP Requests it makes
 * before it stops at a pending `await`. The worker is terminated afterwards, so
 * nothing the example scheduled can run into the next example.
 */
export interface RunExampleInput {
  /** The example as a JavaScript module */
  code: string;
}

export type RunExampleOutput = { requests: unknown[] } | { error: string };

// The server examples talk to; `<server>` in the ambient client stands for it
const placeholderServer = "https://jmap.example.com";
const callIdSeed = 1;
// How long an example may take to make its first JMAP Request
const timeoutMs = 5_000;

const macrotask = () => new Promise((resolve) => setTimeout(resolve, 0));

async function run({ code }: RunExampleInput): Promise<unknown[]> {
  const recorder = recordingFetch();
  seedCallIds(callIdSeed);
  globalThis.fetch = recorder.fetch;
  // The ambient `client` of docs-client.ts; an example's own `client` shadows it.
  Object.assign(globalThis, {
    client: new JsonMetaClient({
      ...docsClientOptions,
      sessionUrl: docsClientOptions.sessionUrl.replace("<server>", placeholderServer),
    }),
  });

  let outcome: { error: unknown } | "done" | undefined;
  import(`data:text/javascript,${encodeURIComponent(code)}`).then(
    () => (outcome = "done"),
    (error: unknown) => (outcome = { error }),
  );
  const started = Date.now();
  let seen = -1;
  for (;;) {
    await macrotask();
    if (typeof outcome === "object") throw outcome.error;
    // Stop once a macrotask passes without a new request…
    const quiet = recorder.count === seen;
    seen = recorder.count;
    if (!quiet) continue;
    const made = (await recorder.settled()).some(({ kind }) => kind === "request");
    // …after the first JMAP Request, or once the example finished or gave up
    if (made || outcome === "done" || Date.now() - started > timeoutMs) break;
  }
  const recorded = await recorder.settled();
  return recorded.filter(({ kind }) => kind === "request").map(({ body }) => body);
}

run(workerData as RunExampleInput).then(
  (requests) => parentPort?.postMessage({ requests } satisfies RunExampleOutput),
  (error: unknown) => parentPort?.postMessage({ error: String(error) } satisfies RunExampleOutput),
);
