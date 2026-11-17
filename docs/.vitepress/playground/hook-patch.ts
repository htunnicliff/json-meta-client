import { fileURLToPath } from "node:url";

type Edit = readonly [before: string, after: string];

const query = "?playground-hooks";
const source = new URL("../../../src/", import.meta.url);
const sourcePath = (file: string) => fileURLToPath(new URL(file, source)).replaceAll("\\", "/");
const client = sourcePath("client.ts");
const dispatcher = sourcePath("internal/dispatcher.ts");
const http = sourcePath("internal/http.ts");

const edits = new Map<string, readonly Edit[]>([
  [
    client,
    [
      [
        `import type { DispatcherOptions } from "./internal/dispatcher.ts";
import { Dispatcher } from "./internal/dispatcher.ts";`,
        `import type { DispatcherOptions } from "./internal/dispatcher.ts${query}";
import { Dispatcher } from "./internal/dispatcher.ts${query}";
import { hookObservers } from "../docs/.vitepress/playground/hook-trace.ts";`,
      ],
      [
        `import { HttpClient } from "./internal/http.ts";`,
        `import { HttpClient } from "./internal/http.ts${query}";`,
      ],
      [
        `this.#http = new HttpClient(options.auth, options.hooks);`,
        `const observeHooks = hookObservers.get(options);
    this.#http = new HttpClient(options.auth, options.hooks, observeHooks);`,
      ],
      [
        `transport: (request, session) =>
        this.#http.fetchJson<JMAPResponse>(session.apiUrl, {`,
        `transport: (request, session, trace) =>
        this.#http.fetchJson<JMAPResponse>(session.apiUrl, "batch", {`,
      ],
      [
        `body: JSON.stringify(request),
        }),`,
        `body: JSON.stringify(request),
        }, trace),`,
      ],
      [`hooks: options.hooks,`, `hooks: options.hooks, observeHooks,`],
      [
        `.fetchJson<ClientSession<GivenCapabilities>>(this.#sessionUrl)`,
        `.fetchJson<ClientSession<GivenCapabilities>>(this.#sessionUrl, "session")`,
      ],
      [
        `this.#http.fetchJson<FileUpload.Result>(url, { method: "POST", body })`,
        `this.#http.fetchJson<FileUpload.Result>(url, "upload", { method: "POST", body })`,
      ],
      [
        `this.#http.fetch(url, { method: "GET" })`,
        `this.#http.fetch(url, "download", { method: "GET" })`,
      ],
      [
        `this.#http.fetch(url, requestOptions, true)`,
        `this.#http.fetch(url, "eventSource", requestOptions)`,
      ],
    ],
  ],
  [
    dispatcher,
    [
      [
        `import type { MethodCall } from "./method-call.ts";`,
        `import type { MethodCall } from "./method-call.ts";
import { callHook } from "../../docs/.vitepress/playground/hook-trace.ts";
import type { HookTrace, ObserveHooks } from "../../docs/.vitepress/playground/hook-trace.ts";`,
      ],
      [
        `(request: JmapRequest, session: Session): Promise<JmapResponse>;`,
        `(request: JmapRequest, session: Session, trace?: HookTrace): Promise<JmapResponse>;`,
      ],
      [
        `export interface DispatcherOptions {`,
        `export interface DispatcherOptions {
  observeHooks?: ObserveHooks;`,
      ],
      [
        `for (const hook of this.#options.hooks?.beforeJmapRequest ?? []) {
      // oxlint-disable-next-line no-await-in-loop
      request = await hook({ request });
    }
    let response = await this.#options.transport(request, session);
    for (const hook of this.#options.hooks?.afterJmapResponse ?? []) {
      // oxlint-disable-next-line no-await-in-loop
      response = await hook({ request, response });
    }`,
        `const trace = this.#options.observeHooks?.({ kind: "batch", method: "POST", url: session.apiUrl });
    for (const [index, hook] of (this.#options.hooks?.beforeJmapRequest ?? []).entries()) {
      request = await callHook(trace, "beforeJmapRequest", index, hook, { request });
    }
    let response = await this.#options.transport(request, session, trace);
    for (const [index, hook] of (this.#options.hooks?.afterJmapResponse ?? []).entries()) {
      response = await callHook(trace, "afterJmapResponse", index, hook, { request, response });
    }`,
      ],
    ],
  ],
  [
    http,
    [
      [
        `type Hooks = NonNullable`,
        `import { callHook } from "../../docs/.vitepress/playground/hook-trace.ts";
import type { HookTarget, HookTrace, ObserveHooks } from "../../docs/.vitepress/playground/hook-trace.ts";

type Hooks = NonNullable`,
      ],
      [
        `constructor(auth: Auth, hooks: Hooks = {}) {
    this.#auth = auth;
    this.#hooks = hooks;
  }`,
        `constructor(auth: Auth, hooks: Hooks = {}, observeHooks?: ObserveHooks) {
    this.#auth = auth;
    this.#hooks = hooks;
    this.#observeHooks = observeHooks;
  }

  readonly #observeHooks: ObserveHooks | undefined;`,
      ],
      [
        `options: RequestInit = {},
    eventSource = false,`,
        `kind: HookTarget["kind"],
    options: RequestInit = {},
    trace?: HookTrace,`,
      ],
      [
        `const hooks = this.#hooks;`,
        `const hooks = this.#hooks;
    const eventSource = kind === "eventSource";`,
      ],
      [
        `const beforeHooks = [
        ...(hooks.beforeFetch ?? []),
        ...(eventSource ? (hooks.beforeEventSourceConnect ?? []) : []),
      ];
      for (const hook of beforeHooks) {
        // oxlint-disable-next-line no-await-in-loop
        request = await hook({ request });
      }
      requestClone = request.clone();`,
        `trace ??= this.#observeHooks?.({ kind, method: request.method, url: request.url });
      const beforeFetch = [...(hooks.beforeFetch ?? [])];
      const beforeConnect = eventSource ? [...(hooks.beforeEventSourceConnect ?? [])] : [];
      for (const [index, hook] of beforeFetch.entries()) {
        request = await callHook(trace, "beforeFetch", index, hook, { request });
      }
      for (const [index, hook] of beforeConnect.entries()) {
        request = await callHook(trace, "beforeEventSourceConnect", index, hook, { request });
      }
      requestClone = request.clone();
      trace?.send(request);`,
      ],
      [
        `for (const hook of hooks.afterFetch ?? []) {
        // oxlint-disable-next-line no-await-in-loop
        response = await hook({ request: requestClone, response });`,
        `for (const [index, hook] of (hooks.afterFetch ?? []).entries()) {
        response = await callHook(trace, "afterFetch", index, hook, { request: requestClone, response });`,
      ],
      [
        `for (const hook of hooks.afterEventSourceConnect ?? []) {
          // oxlint-disable-next-line no-await-in-loop
          await hook({ request: requestClone, response });`,
        `for (const [index, hook] of (hooks.afterEventSourceConnect ?? []).entries()) {
          await callHook(trace, "afterEventSourceConnect", index, hook, { request: requestClone, response });`,
      ],
      [
        `fetchJson = async <T>(url: string | URL, options: RequestInit = {}): Promise<T> => {`,
        `fetchJson = async <T>(url: string | URL, kind: HookTarget["kind"], options: RequestInit = {}, trace?: HookTrace): Promise<T> => {`,
      ],
      [
        `this.fetch(url, { ...options, headers })`,
        `this.fetch(url, kind, { ...options, headers }, trace)`,
      ],
    ],
  ],
]);

/** Only explicitly requested copies of these three modules are instrumented. */
export function hookPatchFile(id: string): string | undefined {
  if (!id.endsWith(query)) return undefined;
  const path = id.slice(0, -query.length);
  const file = (path.startsWith("file:") ? fileURLToPath(path) : path).replaceAll("\\", "/");
  return edits.has(file) ? file : undefined;
}

/** Reject a stale patch when the expected source is missing or ambiguous. */
export function applyHookPatch(file: string, code: string): string {
  const patch = edits.get(file);
  if (!patch) throw new Error(`No playground hook patch for ${file}`);
  for (const [before, after] of patch) {
    const first = code.indexOf(before);
    if (first === -1 || first !== code.lastIndexOf(before)) {
      throw new Error(
        `Cannot apply playground hook patch to ${file}: expected one match for ${before}`,
      );
    }
    code = code.slice(0, first) + after + code.slice(first + before.length);
  }
  return code;
}

export function playgroundHookPatch() {
  return {
    name: "json-meta-client:playground-hook-patch",
    enforce: "pre" as const,
    transform(code: string, id: string) {
      const file = hookPatchFile(id);
      return file ? { code: applyHookPatch(file, code), map: null } : undefined;
    },
  };
}
