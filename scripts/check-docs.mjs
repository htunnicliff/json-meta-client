import { readdir, readFile, mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";

import ts from "typescript";

const root = process.cwd();
const output = path.join(root, ".temp", "docs-snippets");
const fence = /^```(?:ts|typescript)(?:[^\S\n][^\n]*)?\n([\s\S]*?)^```/gm;

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith("."))
      .map(async (entry) => {
        const name = path.join(directory, entry.name);
        return entry.isDirectory() ? markdownFiles(name) : entry.name.endsWith(".md") ? [name] : [];
      }),
  );
  return nested.flat();
}

/**
 * Turns a page into one module holding its TypeScript fences in reading
 * order, so later examples can use what earlier ones declared. Every other
 * line is blanked, keeping line numbers equal to the Markdown source.
 */
function pageModule(contents) {
  const lines = contents.split("\n").map(() => "");
  let fences = 0;
  for (const match of contents.matchAll(fence)) {
    const start = contents.slice(0, match.index).split("\n").length;
    match[1].split("\n").forEach((line, offset) => (lines[start + offset] = line));
    fences++;
  }
  // `export {}` keeps pages without imports from sharing one global scope.
  return { fences, source: `${lines.join("\n")}\nexport {};\n` };
}

await rm(output, { recursive: true, force: true });
try {
  const markdown = [
    path.join(root, "README.md"),
    ...(await markdownFiles(path.join(root, "docs"))),
  ];
  const pageByModule = new Map();
  let count = 0;
  await Promise.all(
    markdown.map(async (file) => {
      const { fences, source } = pageModule(await readFile(file, "utf8"));
      if (!fences) return;
      count += fences;
      const page = path.relative(root, file);
      const module = path.join(output, `${page}.mts`);
      pageByModule.set(module, page);
      await mkdir(path.dirname(module), { recursive: true });
      await writeFile(module, source);
    }),
  );
  // Included examples are checked from their actual files, avoiding a second copy.
  const snippets = (await readdir(path.join(root, "docs", "snippets")))
    .filter((name) => name.endsWith(".ts"))
    .map((name) => path.join(root, "docs", "snippets", name));
  const program = ts.createProgram(
    [path.join(root, "scripts", "docs-client.ts"), ...pageByModule.keys(), ...snippets],
    {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      strict: true,
      noUncheckedIndexedAccess: true,
      noEmit: true,
      skipLibCheck: true,
      types: ["node"],
    },
  );
  const diagnostics = ts.getPreEmitDiagnostics(program);
  for (const diagnostic of diagnostics) {
    let location = "";
    if (diagnostic.file && diagnostic.start !== undefined) {
      const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
      const file =
        pageByModule.get(diagnostic.file.fileName) ?? path.relative(root, diagnostic.file.fileName);
      location = `${file}:${line + 1}:${character + 1}: `;
    }
    console.error(
      `${location}TS${diagnostic.code}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`,
    );
  }
  if (!count) throw new Error("No documented TypeScript examples found");
  if (diagnostics.length) process.exitCode = 1;
  else
    console.log(
      `Checked ${count} TypeScript fences on ${pageByModule.size} pages and ${snippets.length} included snippets against public package exports.`,
    );
} finally {
  await rm(output, { recursive: true, force: true });
}
