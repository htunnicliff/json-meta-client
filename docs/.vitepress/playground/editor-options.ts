/**
 * Compiler options for type checking in the playground's editor, matching
 * those `scripts/check-docs.mjs` checks docs examples with. Plain values
 * rather than TypeScript's enums, so the editor's bundled TypeScript and the
 * tests' TypeScript can share them.
 */
export const editorCompilerOptions = {
  target: 99, // ESNext
  module: 99, // ESNext
  moduleResolution: 100, // Bundler
  moduleDetection: 3, // Force: the code is a module, so top-level `await` works
  lib: ["lib.esnext.d.ts", "lib.dom.d.ts"],
  types: [],
  strict: true,
  noUncheckedIndexedAccess: true,
  allowImportingTsExtensions: true,
  noEmit: true,
  skipLibCheck: true,
} as const;

/**
 * Where the user's code lives in the editor's virtual file system
 */
export const EDITOR_FILE = "/playground.ts";
