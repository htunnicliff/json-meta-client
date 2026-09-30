import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

export async function emitRfcDeclarations(): Promise<string> {
  const sourceRoot = dirname(fileURLToPath(import.meta.resolve("jmap-rfc-types")));
  const outDir = await mkdtemp(join(tmpdir(), "json-meta-client-rfc-types-"));
  const files = await readdir(sourceRoot, { recursive: true });
  const program = ts.createProgram({
    rootNames: files.filter((file) => file.endsWith(".ts")).map((file) => join(sourceRoot, file)),
    options: {
      declaration: true,
      emitDeclarationOnly: true,
      noEmitOnError: true,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ESNext,
      allowImportingTsExtensions: true,
      rootDir: sourceRoot,
      outDir,
      skipLibCheck: true,
      strict: true,
      types: [],
    },
  });
  const result = program.emit();
  const diagnostics = [...ts.getPreEmitDiagnostics(program), ...result.diagnostics];
  if (diagnostics.length) {
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: (file) => file,
        getCurrentDirectory: () => sourceRoot,
        getNewLine: () => "\n",
      }),
    );
  }
  return outDir;
}
