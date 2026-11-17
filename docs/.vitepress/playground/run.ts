import { docsClientOptions } from "../../../scripts/docs-client-options.ts";
import { JsonMetaClient } from "../../../src/index.ts";
import { recordingFetch, seedCallIds } from "../recorder/index.ts";
import { SHIM_SPECIFIER } from "./protocol.ts";
import type { RunEvent } from "./protocol.ts";
import { createShim } from "./shim.ts";

/**
 * The server that `<server>` in the docs' ambient client stands for, as in
 * the docs build
 */
export const PLACEHOLDER_SERVER = "https://jmap.example.com";

/**
 * The seed of call ids, the same as the docs build's, so a docs example shows
 * the same ids in the playground as in its "JMAP Request" tab
 */
export const CALL_ID_SEED = 1;

// How many macrotasks must pass without a new request before a run is idle
const QUIET_MACROTASKS = 2;

const macrotask = () => new Promise((resolve) => setTimeout(resolve, 0));

const dataUrl = (code: string) => `data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`;

/**
 * Run compiled user code with a placeholder Session and a `fetch` that records
 * each request and leaves it pending. Expects a realm of its own, such as a
 * fresh worker: it replaces `fetch` and `crypto.getRandomValues`, and adds the
 * docs' ambient `client`.
 */
export function run(code: string, post: (event: RunEvent) => void): void {
  seedCallIds(CALL_ID_SEED);
  const customUrns = new Set<string>();
  const recorder = recordingFetch({
    extraUrns: () => [...customUrns],
    onRecord: (request, index) => post({ type: "request", index, request }),
  });
  globalThis.fetch = (...args) => {
    watch();
    return recorder.fetch(...args);
  };

  const shim = createShim((urns) => urns.forEach((urn) => customUrns.add(urn)));
  const shimKey = "__jsonMetaClientShim";
  Object.assign(globalThis, {
    [shimKey]: shim,
    // The ambient `client` of docs examples; the code's own `client` shadows it
    client: new JsonMetaClient({
      ...docsClientOptions,
      sessionUrl: docsClientOptions.sessionUrl.replace("<server>", PLACEHOLDER_SERVER),
    }),
  });
  const shimModule = `const { ${Object.keys(shim).join(", ")} } = globalThis.${shimKey};\nexport { ${Object.keys(shim).join(", ")} };\n`;
  const module = code.replaceAll(
    JSON.stringify(SHIM_SPECIFIER),
    JSON.stringify(dataUrl(shimModule)),
  );

  // Report "idle" once requests stop for a few macrotasks; any later request
  // starts watching again.
  let finished = false;
  let watching = false;
  let activity = 0;
  async function quiet() {
    let seen = -1;
    let quietFor = 0;
    while (quietFor < QUIET_MACROTASKS) {
      // oxlint-disable-next-line no-await-in-loop
      await macrotask();
      quietFor = activity === seen ? quietFor + 1 : 0;
      seen = activity;
    }
    await recorder.settled();
    watching = false;
    post({ type: "idle", finished });
  }
  function watch() {
    activity++;
    if (watching) return;
    watching = true;
    void quiet();
  }

  watch();
  import(/* @vite-ignore */ dataUrl(module)).then(
    () => {
      finished = true;
      watch();
    },
    (error: unknown) => post({ type: "error", message: describeError(error) }),
  );
}

/**
 * A readable description of a thrown value
 */
export function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return `Uncaught ${String(error)}`;
}
