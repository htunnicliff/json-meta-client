import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

/**
 * A declaration file Monaco receives through `addExtraLib`
 */
export interface DeclarationFile {
  /** The virtual path, which module resolution reads as a real file */
  path: string;
  content: string;
}

export interface DeclarationSources {
  /** The library's bundled declaration file */
  library: string;
  /** type-fest's declarations, keyed by their path within the package */
  typeFest: ReadonlyMap<string, string>;
}

const libraryDirectory = "/node_modules/json-meta-client";
const typeFestDirectory = "/node_modules/type-fest";

/**
 * Place the declarations where Monaco's module resolution expects them.
 *
 * The library ships one bundled declaration file, so its hovers show the
 * names consumers see. type-fest is kept as its own file tree, rather than
 * bundled in, so its types keep their names too.
 */
export function declarationFiles({ library, typeFest }: DeclarationSources): DeclarationFile[] {
  return [
    { path: `${libraryDirectory}/index.d.ts`, content: library },
    ...Array.from(typeFest, ([file, content]) => ({
      path: `${typeFestDirectory}/${toPosix(file)}`,
      content,
    })),
  ];
}

/**
 * Read the declarations the docs build serves to the playground. The library
 * declaration comes from the package build, since that is what consumers see.
 */
export async function readDeclarations(root: string): Promise<DeclarationFile[]> {
  const libraryPath = path.join(root, "dist", "index.d.mts");
  let library: string;
  try {
    library = await readFile(libraryPath, "utf8");
  } catch (error) {
    throw new Error(`Could not read ${libraryPath}. Run \`pnpm build\` before the docs build.`, {
      cause: error,
    });
  }

  const typeFestRoot = path.join(root, "node_modules", "type-fest");
  const declarations = await Promise.all(
    (await readDirectory(typeFestRoot)).map(
      async (file) => [path.relative(typeFestRoot, file), await readFile(file, "utf8")] as const,
    ),
  );

  return declarationFiles({ library, typeFest: new Map(declarations) });
}

/**
 * Every `.d.ts` file under a directory, in a stable order
 */
async function readDirectory(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith("."))
      .toSorted((a, b) => a.name.localeCompare(b.name))
      .map(async (entry) => {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) return readDirectory(file);
        return entry.name.endsWith(".d.ts") ? [file] : [];
      }),
  );
  return files.flat();
}

/** Monaco keys extra libs by URL-style paths on every platform */
function toPosix(file: string): string {
  return file.split(path.sep).join("/");
}
