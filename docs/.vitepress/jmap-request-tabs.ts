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
import { Worker } from "node:worker_threads";

import ts from "typescript";
import type { MarkdownRenderer } from "vitepress";

import type { RunExampleInput, RunExampleOutput } from "./run-example.ts";

const root = fileURLToPath(new URL("../..", import.meta.url));
const docs = path.join(root, "docs");
// Examples import the package from source, so the docs build does not depend
// on `pnpm build`.
const librarySource = path.join(root, "src", "index.ts");
const runner = new URL("./run-example.ts", import.meta.url);
// How long a worker may run an example before it is stopped
const workerTimeoutMs = 15_000;

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
  /** The page, relative to the repository root */
  page: string;
  /** The 1-based line of the example's opening fence */
  line: number;
  source: string;
}

const locate = ({ page, line }: OptedInExample, offset = 0) => `${page}:${line + offset}`;

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
      example = { page, line: index + 1, source: fence.content };
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
 * Type-check each example on its own, with only the ambient `client` of
 * docs-client.ts declared, so an undeclared name fails wherever it appears
 */
function typeCheck(examples: readonly OptedInExample[]): string[] {
  const virtual = new Map(
    examples.map((example, index) => [
      path.join(root, ".temp", "jmap-request-tabs", `example-${index}.ts`),
      example,
    ]),
  );
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    moduleDetection: ts.ModuleDetectionKind.Force,
    paths: { "json-meta-client": [librarySource] },
    allowImportingTsExtensions: true,
    strict: true,
    noUncheckedIndexedAccess: true,
    noEmit: true,
    skipLibCheck: true,
    types: ["node"],
  };
  const host = ts.createCompilerHost(options);
  const fileExists = host.fileExists.bind(host);
  const readFile = host.readFile.bind(host);
  host.fileExists = (file) => virtual.has(file) || fileExists(file);
  host.readFile = (file) => virtual.get(file)?.source ?? readFile(file);
  const program = ts.createProgram(
    [path.join(root, "scripts", "docs-client.ts"), ...virtual.keys()],
    options,
    host,
  );
  return ts.getPreEmitDiagnostics(program).flatMap((diagnostic) => {
    const example = diagnostic.file && virtual.get(diagnostic.file.fileName);
    if (!example || diagnostic.start === undefined) return [];
    const { line } = diagnostic.file!.getLineAndCharacterOfPosition(diagnostic.start);
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
    // The example's first line follows its opening fence
    return [`${locate(example, line + 1)}: TS${diagnostic.code}: ${message}`];
  });
}

/**
 * Turn an example into a module that imports the package from source
 */
function toModule(example: OptedInExample): string {
  const { outputText } = ts.transpileModule(example.source, {
    fileName: "example.ts",
    compilerOptions: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      verbatimModuleSyntax: false,
    },
  });
  const library = JSON.stringify(pathToFileURL(librarySource).href);
  const code = outputText.replaceAll(
    /(\bfrom\s*|\bimport\s*\(\s*)(["'])json-meta-client\2/g,
    (_, prefix: string) => `${prefix}${library}`,
  );
  return `${code}\n//# sourceURL=${locate(example)}\n`;
}

/**
 * Run an example alone in a worker and return the JMAP Requests it makes
 * before it stops at a pending `await`
 */
async function runExample(example: OptedInExample): Promise<unknown[]> {
  const worker = new Worker(runner, {
    workerData: { code: toModule(example) } satisfies RunExampleInput,
  });
  try {
    const output = await new Promise<RunExampleOutput>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`timed out after ${workerTimeoutMs} ms`)),
        workerTimeoutMs,
      );
      worker.once("message", (message: RunExampleOutput) => {
        clearTimeout(timeout);
        resolve(message);
      });
      worker.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
    if ("error" in output) throw new Error(output.error);
    return output.requests;
  } finally {
    await worker.terminate();
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
  const examples: OptedInExample[] = [];
  for (const file of await markdownFiles(docs)) {
    // oxlint-disable-next-line no-await-in-loop
    const markdown = await readFile(file, "utf8");
    examples.push(...findOptedInExamples(path.relative(root, file), markdown));
  }
  const results = new Map<string, string>();
  const runFailures = await Promise.all(
    examples.map(async (example): Promise<string[]> => {
      try {
        const requests = await runExample(example);
        if (requests.length !== 1) {
          return [
            `${locate(example)}: expected the example to make exactly one JMAP Request, but it made ${requests.length}`,
          ];
        }
        results.set(keyOf(example.source), JSON.stringify(requests[0], null, 2));
        return [];
      } catch (error) {
        return [`${locate(example)}: the example failed: ${String(error)}`];
      }
    }),
  );
  const failures = [...typeCheck(examples), ...runFailures.flat()];
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
