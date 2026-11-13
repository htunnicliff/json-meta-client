import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { Worker } from "node:worker_threads";

import ts from "typescript";

import type { RunExampleInput, RunExampleOutput } from "./run-example.ts";

const root = fileURLToPath(new URL("../../../..", import.meta.url));
const docs = path.join(root, "docs");
// Examples import the package from source, so the docs build does not depend
// on `pnpm build`.
const librarySource = path.join(root, "src", "index.ts");
const runner = new URL("./run-example.ts", import.meta.url);
// How long a worker may run an example before it is stopped
const workerTimeoutMs = 15_000;

interface Fence {
  lang: string;
  title: string;
  /** Whether the info string has the `jmap:generated` attribute */
  generated: boolean;
  content: string;
}

interface OptedInExample {
  /** The page, relative to the repository root */
  page: string;
  /** The 1-based line of the example's opening fence */
  line: number;
  source: string;
  /** Top-level names that earlier examples on the page declared */
  inherited: string[];
  /** The generated fence, once the page has one after the example */
  target?: Target;
}

/**
 * The body of a generated fence in a Markdown page
 */
interface Target {
  /** The 0-based line of the first body line */
  start: number;
  /** The 0-based line of the closing fence */
  end: number;
  /** The fence's indentation */
  indent: string;
  /** What the fence holds now */
  content: string;
}

const locate = ({ page, line }: OptedInExample, offset = 0) => `${page}:${line + offset}`;

function parseInfo(info: string): Pick<Fence, "lang" | "title" | "generated"> {
  const lang = info.trim().split(/[\s[{]/, 1)[0] ?? "";
  const title = (/\[(.*)\]/.exec(info)?.[1] ?? "").replaceAll(/~[^~]*~/g, "").trim();
  const generated = /\{[^}]*(?<![\w:-])jmap:generated(?![\w:-])[^}]*\}/.test(info);
  return { lang, title, generated };
}

const isExample = ({ lang }: Pick<Fence, "lang">) => lang === "ts" || lang === "typescript";

/**
 * A fence opts in with the `jmap:generated` attribute, as in
 * `json [JMAP Request] {jmap:generated}`. Its body is written by
 * `pnpm docs:generate` and checked by the docs build.
 */
const optsIn = ({ lang, title, generated }: Fence) =>
  lang === "json" && title === "JMAP Request" && generated;

/**
 * The names an example declares at the top level
 */
function declaredNames(source: string): string[] {
  const file = ts.createSourceFile("example.ts", source, ts.ScriptTarget.ESNext);
  const names: string[] = [];
  const collect = (name: ts.BindingName) => {
    if (ts.isIdentifier(name)) names.push(name.text);
    else name.elements.forEach((element) => ts.isBindingElement(element) && collect(element.name));
  };
  for (const statement of file.statements) {
    if (ts.isVariableStatement(statement)) {
      statement.declarationList.declarations.forEach(({ name }) => collect(name));
    } else if (ts.isFunctionDeclaration(statement) && statement.name) {
      names.push(statement.name.text);
    }
  }
  return names;
}

/**
 * Find the opted-in examples of a Markdown page. An example may use names that
 * earlier examples on the page declared, as the page reads top to bottom.
 */
function findOptedInExamples(page: string, markdown: string): OptedInExample[] {
  const lines = markdown.split("\n").entries();
  const examples: OptedInExample[] = [];
  const declared = new Set<string>();
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
      const own = new Set(declaredNames(fence.content));
      example = {
        page,
        line: index + 1,
        source: fence.content,
        inherited: [...declared].filter((name) => !own.has(name)),
      };
      own.forEach((name) => declared.add(name));
    } else if (optsIn(fence)) {
      if (!example) {
        throw new Error(`${page}:${index + 1}: a JMAP Request fence needs an example before it`);
      }
      example.target = {
        start: index + 1,
        end: index + 1 + body.length,
        indent,
        content: fence.content,
      };
      examples.push(example);
    }
  }
  return examples;
}

/**
 * The example's source, preceded on its first line by the names it uses from
 * earlier examples, each standing for itself, as in `"<inboxId>"`
 */
function withInherited({ source, inherited }: OptedInExample): string {
  const declarations = inherited.map((name) => `const ${name}: any = "<${name}>";`);
  return `${declarations.join(" ")}${declarations.length ? " " : ""}${source}`;
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
  host.readFile = (file) => {
    const example = virtual.get(file);
    return example ? withInherited(example) : readFile(file);
  };
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
  const { outputText } = ts.transpileModule(withInherited(example), {
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
 * What the generated fences of `docs/` should hold, by page
 */
async function generate(): Promise<{
  files: Map<string, { markdown: string; stale: OptedInExample[] }>;
  failures: string[];
}> {
  const examples: OptedInExample[] = [];
  const files = new Map<string, { markdown: string; stale: OptedInExample[] }>();
  for (const file of await markdownFiles(docs)) {
    // oxlint-disable-next-line no-await-in-loop
    const markdown = await readFile(file, "utf8");
    const page = path.relative(root, file);
    const found = findOptedInExamples(page, markdown);
    if (found.length) files.set(file, { markdown, stale: [] });
    examples.push(...found);
  }
  const results = new Map<OptedInExample, string>();
  const runFailures = await Promise.all(
    examples.map(async (example): Promise<string[]> => {
      try {
        const requests = await runExample(example);
        if (requests.length !== 1) {
          return [
            `${locate(example)}: expected the example to make exactly one JMAP Request, but it made ${requests.length}`,
          ];
        }
        results.set(example, JSON.stringify(requests[0], null, 2));
        return [];
      } catch (error) {
        return [`${locate(example)}: the example failed: ${String(error)}`];
      }
    }),
  );
  const failures = [...typeCheck(examples), ...runFailures.flat()];
  const byPage = Map.groupBy(examples, ({ page }) => page);
  for (const [file, entry] of files) {
    const pageExamples = byPage.get(path.relative(root, file)) ?? [];
    const lines = entry.markdown.split("\n");
    // From the last fence up, so earlier line numbers stay valid
    for (const example of pageExamples.toReversed()) {
      const json = results.get(example);
      const { target } = example;
      if (json === undefined || !target) continue;
      if (!sameJson(target.content, json)) {
        entry.stale.push(example);
        const body = json.split("\n").map((line) => `${target.indent}${line}`);
        lines.splice(target.start, target.end - target.start, ...body);
      }
    }
    entry.markdown = lines.join("\n");
  }
  return { files, failures };
}

/**
 * Whether the JSON is the same, whatever its formatting
 */
function sameJson(a: string, b: string): boolean {
  try {
    return isDeepStrictEqual(JSON.parse(a), JSON.parse(b));
  } catch {
    return false;
  }
}

/**
 * Run every opted-in example under `docs/` and compare its JMAP Request with
 * the fence that follows it. With `write`, stale fences are rewritten;
 * otherwise they fail the build. Fails, naming each page and line, when an
 * example errors or does not make exactly one JMAP Request.
 */
export async function syncJmapRequests({ write }: { write: boolean }): Promise<void> {
  const { files, failures } = await generate();
  const stale = [...files.values()].flatMap((entry) => entry.stale);
  if (!failures.length && write) {
    await Promise.all(
      [...files]
        .filter(([, { stale }]) => stale.length)
        .map(([file, { markdown }]) => writeFile(file, markdown)),
    );
    return;
  }
  if (!write) {
    failures.push(
      ...stale.map((example) => `${locate(example)}: the JMAP Request fence is out of date`),
    );
  }
  if (failures.length) {
    throw new Error(
      `Could not check JMAP Requests:\n${failures.join("\n")}${write ? "" : "\nRun `pnpm docs:generate` to update them."}`,
    );
  }
}
