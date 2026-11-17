import { docsClientOptions } from "../../../scripts/docs-client-options.ts";
import { JsonMetaClient } from "../../../src/index.ts";
import { fillPlaceholders, recordingFetch, seedCallIds } from "../recorder/index.ts";
import type { RecordedKind } from "../recorder/index.ts";
import { formatConsoleArgs } from "./format.ts";
import type { ObserveHooks } from "./hook-trace.ts";
import { SHIM_SPECIFIER } from "./protocol.ts";
import type { ConsoleLevel, Connection, RunEvent } from "./protocol.ts";
import { createShim } from "./shim.ts";
import { createTracer, TRACER } from "./tracer.ts";

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
export function run(
  Client: typeof JsonMetaClient,
  code: string,
  post: (event: RunEvent) => void,
  connection?: Connection,
): void {
  seedCallIds(CALL_ID_SEED);
  forwardConsole(post);
  const tracer = createTracer();
  traceCallIds(tracer.onCallId);
  const customUrns = new Set<string>();
  const operations = new WeakMap<Request, { id: number; kind: RecordedKind }>();
  const sentOperations = new Map<number, number>();
  let nextOperation = 0;
  let activeHooks = 0;
  const observeHooks: ObserveHooks = (target) => {
    const operation = nextOperation++;
    return {
      update(call, state) {
        activeHooks += state.status === "running" ? 1 : -1;
        post({
          type: "hook",
          operation,
          target,
          call: {
            ...call,
            status: state.status,
            ...(state.status === "failed" && { message: describeError(state.error) }),
          },
        });
        watch();
      },
      send(request) {
        operations.set(request, {
          id: operation,
          kind: target.kind === "batch" ? "request" : target.kind,
        });
      },
    };
  };
  const recorder = recordingFetch({
    kindFor: (input) => (input instanceof Request ? operations.get(input)?.kind : undefined),
    extraUrns: () => [...customUrns],
    onRecord: (request, index) => {
      const operation = sentOperations.get(index);
      sentOperations.delete(index);
      post({ type: "request", index, request, operation });
    },
    onResponse: (response, index) => {
      post({ type: "response", index, response });
      watch();
    },
    // Connected: send requests on and record their responses
    ...(connection && { passThrough: globalThis.fetch.bind(globalThis) }),
  });
  globalThis.fetch = (...args) => {
    const request = args[0] instanceof Request ? args[0] : undefined;
    const operation = request && operations.get(request);
    if (operation) sentOperations.set(recorder.count, operation.id);
    watch();
    const result = recorder.fetch(...args);
    if (request) operations.delete(request);
    return result;
  };

  const server = connection && { sessionUrl: connection.sessionUrl, auth: connection.auth };
  const shim = createShim((urns) => urns.forEach((urn) => customUrns.add(urn)), server, {
    Client,
    observeHooks,
  });
  const shimKey = "__jsonMetaClientShim";
  Object.assign(globalThis, {
    [shimKey]: shim,
    [TRACER]: tracer.runtime,
    // The ambient `client` of docs examples; the code's own `client` shadows it
    client: new JsonMetaClient(fillPlaceholders(docsClientOptions, server)),
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
    post({ type: "trace", trace: tracer.trace() });
    post({ type: "idle", finished: finished && activeHooks === 0 });
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
    (error: unknown) => post({ type: "error", message: describeError(error, connection) }),
  );
}

/**
 * Report the hex form of each draw of 4 random bytes, the suffix the library
 * gives a call id (`Email/query::f3c9ebfd`), so it can be tied to the call
 * site that made it
 */
function traceCallIds(onCallId: (suffix: string) => void) {
  const draw = crypto.getRandomValues.bind(crypto);
  Object.defineProperty(crypto, "getRandomValues", {
    configurable: true,
    writable: true,
    value: <T extends ArrayBufferView | null>(array: T): T => {
      const result = draw(array);
      if (array && array.byteLength === 4) {
        const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
        onCallId(Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(""));
      }
      return result;
    },
  });
}

const consoleLevels: readonly ConsoleLevel[] = ["log", "info", "warn", "error", "debug"];

/**
 * Post each `console` call, including the library's own warnings, as text
 */
function forwardConsole(post: (event: RunEvent) => void) {
  for (const level of consoleLevels) {
    console[level] = (...args: unknown[]) => {
      let text: string;
      try {
        text = formatConsoleArgs(args);
      } catch (error) {
        text = `[Could not format: ${describeError(error)}]`;
      }
      post({ type: "console", level, text });
    };
  }
}

/**
 * A readable description of a thrown value
 */
export function describeError(error: unknown, connection?: Connection): string {
  if (!(error instanceof Error)) return `Uncaught ${String(error)}`;
  const description = `${error.name}: ${error.message}`;
  // Browsers report a request that CORS blocks only as a failed fetch
  return connection && error.name === "NetworkError"
    ? `${description}. If the server is reachable, it may not allow this site through CORS.`
    : description;
}
