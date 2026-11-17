import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const typeFest = path.join(root, "node_modules", "type-fest");

/**
 * The module that provides {@link collectTypes}' files to the editor
 */
export const TYPES_MODULE = "virtual:playground-types";

/**
 * Declaration files for the playground's editor, by path in its virtual file
 * system: the library under `node_modules/json-meta-client`, the parts of
 * `type-fest` it uses, and the modules that declare the docs' ambient
 * `client`
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
 * Provides {@link TYPES_MODULE}, built when first imported
 */
export function playgroundTypes(): VitePlugin {
  const resolved = `\0${TYPES_MODULE}`;
  return {
    name: "json-meta-client:playground-types",
    resolveId: (source) => (source === TYPES_MODULE ? resolved : undefined),
    load: (id) =>
      id === resolved ? `export default ${JSON.stringify(collectTypes())};` : undefined,
  };
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
  Object.assign(files, typeFestFiles(Object.values(library)));
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
  if (!config) throw new Error("Could not read tsconfig.json");
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

/**
 * The `type-fest` files that the declarations reach, with an index that
 * exports only what they import from it, so the editor loads a small part
 * of the package
 */
function typeFestFiles(declarations: readonly string[]): TypeFiles {
  const names = new Set(
    declarations.flatMap((text) =>
      [...text.matchAll(/import(?:\s+type)?\s*\{([^}]*)\}\s*from\s*"type-fest"/g)].flatMap(
        ([, list = ""]) => list.split(",").map((name) => name.trim()),
      ),
    ),
  );
  names.delete("");
  const fullIndex = ts.createSourceFile(
    "index.d.ts",
    ts.sys.readFile(path.join(typeFest, "index.d.ts"))!,
    ts.ScriptTarget.ESNext,
  );
  const exports = fullIndex.statements
    .filter(ts.isExportDeclaration)
    // Star exports hold the basic types, such as `JsonValue`
    .filter(
      ({ exportClause }) =>
        !exportClause ||
        (ts.isNamedExports(exportClause) &&
          exportClause.elements.some(({ name }) => names.has(name.text))),
    )
    .map((statement) => statement.getText(fullIndex));
  const index = `${exports.join("\n")}\n`;

  // Every file the reduced index reaches
  const indexPath = path.join(typeFest, "index.d.ts");
  const options: ts.CompilerOptions = { noEmit: true, types: [], noLib: true };
  const host = ts.createCompilerHost(options);
  const readFile = host.readFile.bind(host);
  host.readFile = (file) => (file === indexPath ? index : readFile(file));
  const program = ts.createProgram([indexPath], options, host);
  const files: TypeFiles = {};
  for (const source of program.getSourceFiles()) {
    if (!source.fileName.startsWith(typeFest)) continue;
    const relative = path.relative(root, source.fileName).split(path.sep).join("/");
    files[relative] = source.fileName === indexPath ? index : source.text;
  }
  files["node_modules/type-fest/package.json"] = JSON.stringify({
    name: "type-fest",
    types: "./index.d.ts",
  });
  return files;
}
