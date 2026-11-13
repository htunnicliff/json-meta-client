import * as library from "../../../src/index.ts";
import { recordingFetch, seedCallIds } from "../recorder/index.ts";
import type { RunnerMessage } from "./messages.ts";
import { shimGlobals, shimSource } from "./shim.ts";
import type { ShimGlobals } from "./shim.ts";
import { transpile } from "./transpile.ts";

/**
 * The same seed the docs build uses, so playground Requests match the generated
 * "JMAP Request" tabs
 */
const callIdSeed = 1;

export interface RunOptions {
  /** The user's TypeScript source */
  code: string;
  /** Receive each recorded request, error, and waiting state */
  post(this: void, message: RunnerMessage): void;
  /**
   * Turn module source into a URL that `import()` can load. Defaults to a Blob
   * URL, which Node cannot import; tests pass a data URL instead.
   */
  moduleUrl?(this: void, source: string): string;
}

export interface RunHandle {
  /** Stop watching for requests and restore everything the run changed */
  stop(): void;
}

/**
 * Run user code with the request recorder in place. A fresh run is needed for
 * every execution: pending fetches never settle, and a run that stops early is
 * terminated with its worker.
 */
export function startRun({ code, post, moduleUrl = blobModuleUrl }: RunOptions): RunHandle {
  const recorder = recordingFetch();
  const restoreCallIds = seedCallIds(callIdSeed);
  const originalFetch = globalThis.fetch;
  const moduleUrls: string[] = [];

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let posted = 0;
  let waiting = false;
  let failed = false;
  // Whether execution has made a request or finished; until then, a quiet
  // macrotask only means the module is still loading
  let executionStarted = false;

  const report = errorReporter(post);
  const reportFailure = (error: unknown) => {
    failed = true;
    report(error);
  };
  const stopListening = listenForErrors(reportFailure);

  Object.assign(globalThis, {
    [shimGlobals]: {
      library,
      configure(capabilities) {
        if (!Array.isArray(capabilities)) return;
        recorder.supportCapabilities(capabilities.filter(isCapabilityObject).map(({ urn }) => urn));
      },
    } satisfies ShimGlobals,
  });
  globalThis.fetch = recorder.fetch;

  const createModule = (source: string): string => {
    const url = moduleUrl(source);
    moduleUrls.push(url);
    return url;
  };

  const tick = (): void => {
    if (stopped) return;
    void (async () => {
      const { count } = recorder;
      if (count !== posted) {
        executionStarted = true;
        const recorded = await recorder.settled();
        for (; posted < recorded.length; posted++) {
          post({ type: "request", request: recorded[posted] });
        }
        waiting = false;
      } else if (executionStarted && !waiting && !failed) {
        waiting = true;
        post({ type: "waiting" });
      }
      // Poll quickly while requests are expected, and slowly otherwise, so a
      // run that is waiting or failed does not busy-loop
      if (!stopped) timer = setTimeout(tick, executionStarted && !waiting && !failed ? 0 : 100);
    })();
  };
  // The module gets a macrotask to start before the first check
  timer = setTimeout(tick, 0);

  void (async () => {
    try {
      const shimUrl = createModule(shimSource(Object.keys(library)));
      const url = createModule(await transpile(code, shimUrl));
      await import(/* @vite-ignore */ url);
      executionStarted = true;
    } catch (error) {
      reportFailure(error);
    }
  })();

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
      stopListening();
      restoreCallIds();
      globalThis.fetch = originalFetch;
      Reflect.deleteProperty(globalThis, shimGlobals);
      for (const url of moduleUrls) URL.revokeObjectURL(url);
    },
  };
}

function blobModuleUrl(source: string): string {
  return URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
}

/**
 * A capability passed by user code, which may be a built-in's string name
 */
function isCapabilityObject(value: unknown): value is { urn: string } {
  return (
    typeof value === "object" && value !== null && "urn" in value && typeof value.urn === "string"
  );
}

/**
 * Report each error once, even when it arrives both as a rejected import and
 * as an uncaught error event
 */
function errorReporter(post: (message: RunnerMessage) => void): (error: unknown) => void {
  const reported = new WeakSet();
  return (error) => {
    if (typeof error === "object" && error !== null) {
      if (reported.has(error)) return;
      reported.add(error);
    }
    post({ type: "error", message: describeError(error) });
  };
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.stack ?? `${error.name}: ${error.message}`;
  return String(error);
}

/**
 * Forward errors the user's code does not catch, including ones thrown after
 * its module finishes evaluating
 */
function listenForErrors(report: (error: unknown) => void): () => void {
  // Workers and browsers provide these; Node, where the runner is tested,
  // provides neither
  if (typeof globalThis.addEventListener !== "function") return () => {};

  const onError = (event: ErrorEvent) => {
    // Keep the page's own worker error listener from replacing this report
    event.preventDefault();
    report(event.error ?? event.message);
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    event.preventDefault();
    report(event.reason);
  };
  globalThis.addEventListener("error", onError);
  globalThis.addEventListener("unhandledrejection", onRejection);
  return () => {
    globalThis.removeEventListener("error", onError);
    globalThis.removeEventListener("unhandledrejection", onRejection);
  };
}
