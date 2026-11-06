import { readdir, readFile, mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";

import ts from "typescript";

const root = process.cwd();
const output = path.join(root, ".temp", "docs-snippets");
const sources = new Map();

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

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
try {
  const markdown = [
    path.join(root, "README.md"),
    ...(await markdownFiles(path.join(root, "docs"))),
  ];
  let count = 0;
  const documents = await Promise.all(
    markdown.map(async (file) => ({ file, contents: await readFile(file, "utf8") })),
  );
  const writes = [];
  for (const { file, contents } of documents) {
    // Each TypeScript fence is an independent, complete public-package example.
    for (const match of contents.matchAll(
      /^```(?:ts|typescript)(?:[^\S\n][^\n]*)?\n([\s\S]*?)^```/gm,
    )) {
      const name = path.join(output, `example-${++count}.mts`);
      const line = contents.slice(0, match.index).split("\n").length;
      sources.set(name, `${path.relative(root, file)}:${line}`);
      writes.push(writeFile(name, match[1]));
    }
  }
  await Promise.all(writes);
  // Included examples are checked from their actual files, avoiding a second copy.
  const snippets = (await readdir(path.join(root, "docs", "snippets")))
    .filter((name) => name.endsWith(".ts"))
    .map((name) => path.join(root, "docs", "snippets", name));
  const program = ts.createProgram([...sources.keys(), ...snippets], {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: true,
    noUncheckedIndexedAccess: true,
    noEmit: true,
    skipLibCheck: true,
    types: ["node"],
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  for (const diagnostic of diagnostics) {
    let location = "";
    if (diagnostic.file && diagnostic.start !== undefined) {
      const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
      location = `${sources.get(diagnostic.file.fileName) ?? path.relative(root, diagnostic.file.fileName)} (snippet ${line + 1}:${character + 1}): `;
    }
    console.error(
      `${location}TS${diagnostic.code}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`,
    );
  }
  if (!count) throw new Error("No documented TypeScript examples found");
  if (diagnostics.length) process.exitCode = 1;
  else
    console.log(
      `Checked ${count} TypeScript fences and ${snippets.length} included snippets against public package exports.`,
    );
} finally {
  await rm(output, { recursive: true, force: true });
}
