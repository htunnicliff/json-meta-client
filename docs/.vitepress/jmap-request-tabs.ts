// Fills the "JMAP Request" tab of a docs code group from the JMAP Request its
// TypeScript example actually produces.
//
// Inside a `::: code-group`, a `json` fence titled `JMAP Request` with an
// empty body opts in: the `ts` fence before it in the same group runs against
// a placeholder Session during the build, and its one JMAP Request fills the
// fence. A fence with a body is hand-written and left alone.
//
// markdown-it renders synchronously, so the examples run in a pass before the
// build, and the plugin looks their results up by the example's source.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import ts from "typescript";
import type { MarkdownRenderer } from "vitepress";

import { recordingFetch, seedCallIds } from "./recorder/index.ts";

const root = fileURLToPath(new URL("../..", import.meta.url));
const docs = path.join(root, "docs");
// Examples import the package from source, so the docs build does not depend
// on `pnpm build`.
const library = pathToFileURL(path.join(root, "src", "index.ts")).href;

const callIdSeed = 1;
// Matches docs-client.ts, with a URL the client accepts.
const ambientClientOptions = {
  auth: "<token>",
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  capabilities: ["mail", "submission"],
};
// How long an example may take to make its first JMAP Request
const timeoutMs = 5_000;

/**
 * Pretty-printed JMAP Requests, keyed by the example that produces them
 */
export type JmapRequests = ReadonlyMap<string, string>;

interface Fence {
  lang: string;
  title: string;
  content: string;
}

interface OptedInExample {
  /** `page:line` of the example's fence */
  location: string;
  source: string;
}

function parseInfo(info: string): Pick<Fence, "lang" | "title"> {
  const lang = info.trim().split(/[\s[{]/, 1)[0] ?? "";
  const title = (/\[(.*)\]/.exec(info)?.[1] ?? "").replaceAll(/~[^~]*~/g, "").trim();
  return { lang, title };
}

const isExample = ({ lang }: Pick<Fence, "lang">) => lang === "ts" || lang === "typescript";

const optsIn = ({ lang, title, content }: Fence) =>
  lang === "json" && title === "JMAP Request" && content.trim() === "";

/**
 * The key an example's result is stored under, insensitive to trailing
 * whitespace
 */
const keyOf = (source: string) => source.trimEnd();

/**
 * Find the opted-in examples of a Markdown page
 */
function findOptedInExamples(page: string, markdown: string): OptedInExample[] {
  const lines = markdown.split("\n").entries();
  const examples: OptedInExample[] = [];
  let inGroup = false;
  let example: OptedInExample | undefined;
  for (const [index, line] of lines) {
    if (/^\s*:::\s*code-group\b/.test(line)) {
      inGroup = true;
      example = undefined;
      continue;
    }
    if (inGroup && /^\s*:::\s*$/.test(line)) {
      inGroup = false;
      continue;
    }
    const open = /^( *)(`{3,}|~{3,})(.*)$/.exec(line);
    if (!open) continue;
    const [, indent = "", marker = "", info = ""] = open;
    const close = new RegExp(`^ *${marker[0] === "`" ? "`" : "~"}{${marker.length},}\\s*$`);
    const dedent = new RegExp(`^ {0,${indent.length}}`);
    const body: string[] = [];
    // The fence's body is consumed from the same lines, up to its closing fence.
    for (const [, bodyLine] of lines) {
      if (close.test(bodyLine)) break;
      body.push(bodyLine.replace(dedent, ""));
    }
    if (!inGroup) continue;
    const fence = { ...parseInfo(info), content: body.join("\n") };
    if (isExample(fence)) {
      example = { location: `${page}:${index + 1}`, source: fence.content };
    } else if (optsIn(fence)) {
      if (!example) {
        throw new Error(`${page}:${index + 1}: a JMAP Request fence needs an example before it`);
      }
      examples.push(example);
    }
  }
  return examples;
}

/**
 * Turn an example into a module that imports the package from source
 */
function toModule({ location, source }: OptedInExample, nonce: number): string {
  const { outputText } = ts.transpileModule(source, {
    fileName: "example.ts",
    compilerOptions: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      verbatimModuleSyntax: false,
    },
  });
  const code = outputText.replaceAll(
    /(\bfrom\s*|\bimport\s*\(\s*)(["'])json-meta-client\2/g,
    (_, prefix: string) => `${prefix}${JSON.stringify(library)}`,
  );
  // The nonce gives every run its own module instead of a cached one.
  return `${code}\n//# sourceURL=${location}?run=${nonce}\n`;
}

let moduleNonce = 0;
const macrotask = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Run an example alone, with a placeholder Session and a pending `fetch`, and
 * return the JMAP Requests it makes before it stops at a pending `await`
 */
async function runExample(example: OptedInExample): Promise<unknown[]> {
  const { JsonMetaClient } = await import(library);
  const recorder = recordingFetch();
  const scope = globalThis as { fetch: typeof fetch; client?: unknown };
  const originalFetch = scope.fetch;
  const restoreCallIds = seedCallIds(callIdSeed);
  scope.fetch = recorder.fetch;
  // The ambient `client` of docs-client.ts; an example's own `client` shadows it.
  scope.client = new JsonMetaClient(ambientClientOptions);
  try {
    let outcome: { error: unknown } | "done" | undefined;
    import(`data:text/javascript,${encodeURIComponent(toModule(example, ++moduleNonce))}`).then(
      () => (outcome = "done"),
      (error: unknown) => (outcome = { error }),
    );
    const started = Date.now();
    let seen = -1;
    for (;;) {
      // oxlint-disable-next-line no-await-in-loop
      await macrotask();
      if (typeof outcome === "object") throw outcome.error;
      const quiet = recorder.count === seen;
      seen = recorder.count;
      if (!quiet) continue;
      // oxlint-disable-next-line no-await-in-loop
      const made = (await recorder.settled()).some(({ kind }) => kind === "request");
      if (made || outcome === "done" || Date.now() - started > timeoutMs) break;
    }
    const recorded = await recorder.settled();
    return recorded.filter(({ kind }) => kind === "request").map(({ body }) => body);
  } finally {
    scope.fetch = originalFetch;
    delete scope.client;
    restoreCallIds();
  }
}

async function markdownFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { recursive: true });
  return entries
    .filter((entry) => entry.endsWith(".md"))
    .filter((entry) => !entry.split(path.sep).some((segment) => segment.startsWith(".")))
    .map((entry) => path.join(directory, entry));
}

/**
 * Run every opted-in example under `docs/` and collect its JMAP Request.
 * Fails, naming each page and line, when an example errors or does not make
 * exactly one JMAP Request.
 */
export async function recordJmapRequests(): Promise<JmapRequests> {
  const results = new Map<string, string>();
  const failures: string[] = [];
  for (const file of await markdownFiles(docs)) {
    const page = path.relative(root, file);
    // oxlint-disable-next-line no-await-in-loop
    for (const example of findOptedInExamples(page, await readFile(file, "utf8"))) {
      try {
        // oxlint-disable-next-line no-await-in-loop
        const requests = await runExample(example);
        if (requests.length !== 1) {
          failures.push(
            `${example.location}: expected the example to make exactly one JMAP Request, but it made ${requests.length}`,
          );
          continue;
        }
        results.set(keyOf(example.source), JSON.stringify(requests[0], null, 2));
      } catch (error) {
        failures.push(`${example.location}: the example failed: ${String(error)}`);
      }
    }
  }
  if (failures.length) {
    throw new Error(`Could not generate JMAP Request tabs:\n${failures.join("\n")}`);
  }
  return results;
}

/**
 * A markdown-it plugin that fills each opted-in fence from `requests`
 */
export function jmapRequestTabs(requests: JmapRequests) {
  return (md: MarkdownRenderer): void => {
    md.core.ruler.push("jmap_request_tabs", (state) => {
      let inGroup = false;
      let example: string | undefined;
      for (const token of state.tokens) {
        if (token.type === "container_code-group_open") {
          inGroup = true;
          example = undefined;
        } else if (token.type === "container_code-group_close") {
          inGroup = false;
        } else if (inGroup && token.type === "fence") {
          const fence = { ...parseInfo(token.info), content: token.content };
          if (isExample(fence)) {
            example = token.content;
          } else if (optsIn(fence)) {
            const json = example === undefined ? undefined : requests.get(keyOf(example));
            if (json === undefined) {
              // oxlint-disable-next-line typescript/no-unsafe-type-assertion
              const page = (state.env as { relativePath?: string }).relativePath ?? "a page";
              throw new Error(
                `${page}:${(token.map?.[0] ?? 0) + 1}: no JMAP Request was recorded for this example; restart the docs server after changing it`,
              );
            }
            token.content = `${json}\n`;
          }
        }
      }
    });
  };
}
