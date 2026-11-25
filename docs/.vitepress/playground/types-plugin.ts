import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

import { editorCompilerOptions } from "./editor-options.ts";

const root = fileURLToPath(new URL("../../..", import.meta.url));

/**
 * The module that provides {@link collectTypes}' files to the editor
 */
export const TYPES_MODULE = "virtual:playground-types";

/**
 * The module that provides {@link collectLibs}' files to the editor's
 * TypeScript worker
 */
export const LIBS_MODULE = "virtual:playground-libs";

/**
 * Declaration files for the playground's editor, by path in its virtual file
 * system: the library under `node_modules/json-meta-client`, and the modules
 * that declare the docs' ambient `client`
 */
export type TypeFiles = Record<string, string>;

/**
 * The part of a Vite plugin this one uses
 */
interface VitePlugin {
  name: string;
  resolveId(source: string): string | undefined;
  load(id: string): string | undefined;
}

/**
 * Provides {@link TYPES_MODULE} and {@link LIBS_MODULE}, each built when
 * first imported
 */
export function playgroundTypes(): VitePlugin {
  const modules: Record<string, () => TypeFiles> = {
    [`\0${TYPES_MODULE}`]: collectTypes,
    [`\0${LIBS_MODULE}`]: collectLibs,
  };
  return {
    name: "json-meta-client:playground-types",
    resolveId: (source) =>
      source === TYPES_MODULE || source === LIBS_MODULE ? `\0${source}` : undefined,
    load: (id) => {
      const collect = modules[id];
      return collect ? `export default ${JSON.stringify(collect())};` : undefined;
    },
  };
}

/**
 * TypeScript's lib files for the editor's compiler options, by file name,
 * such as `lib.esnext.d.ts`, with every lib file they reference
 */
export function collectLibs(): TypeFiles {
  const root = "/virtual/empty.ts";
  const options: ts.CompilerOptions = { lib: [...editorCompilerOptions.lib], noEmit: true };
  const host = ts.createCompilerHost(options);
  const readFile = host.readFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  host.readFile = (file) => (file === root ? "" : readFile(file));
  host.fileExists = (file) => file === root || fileExists(file);
  const program = ts.createProgram([root], options, host);
  const libDirectory = path.dirname(ts.getDefaultLibFilePath(options));
  return Object.fromEntries(
    program
      .getSourceFiles()
      .filter(({ fileName }) => path.dirname(fileName) === libDirectory)
      .map(({ fileName, text }) => [path.basename(fileName), text]),
  );
}

/**
 * Emit the library's declarations from source, so the docs build does not
 * depend on `pnpm build`, and collect what the editor needs to resolve them
 */
export function collectTypes(): TypeFiles {
  const files: TypeFiles = {};
  const library = emitLibraryDeclarations();
  for (const [file, text] of Object.entries(library)) {
    files[`node_modules/json-meta-client/${file}`] = text;
  }
  files["node_modules/json-meta-client/package.json"] = JSON.stringify({
    name: "json-meta-client",
    types: "./index.d.ts",
  });
  // The ambient `client` of docs examples, declared as the docs check does
  for (const name of ["docs-client.ts", "docs-client-options.ts"]) {
    files[name] = ts.sys.readFile(path.join(root, "scripts", name))!;
  }
  return files;
}

function emitLibraryDeclarations(): Record<string, string> {
  const config = ts.getParsedCommandLineOfConfigFile(
    path.join(root, "tsconfig.json"),
    {},
    { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} },
  );
  if (!config) {
    throw new Error("Could not read tsconfig.json");
  }
  const outDir = path.join(root, "src");
  const program = ts.createProgram([path.join(root, "src", "index.ts")], {
    ...config.options,
    declaration: true,
    emitDeclarationOnly: true,
    declarationMap: false,
    sourceMap: false,
    noEmit: false,
    outDir,
  });
  const output: Record<string, string> = {};
  const { emitSkipped, diagnostics } = program.emit(undefined, (file, text) => {
    // The editor's TypeScript resolves `./a.js` to `./a.d.ts`
    output[path.relative(outDir, file).split(path.sep).join("/")] = text.replaceAll(
      /(["'])(\.{1,2}\/[^"']*)\.ts\1/g,
      "$1$2.js$1",
    );
  });
  if (emitSkipped) {
    throw new Error(ts.formatDiagnostics(diagnostics, ts.createCompilerHost(config.options)));
  }
  return output;
}
