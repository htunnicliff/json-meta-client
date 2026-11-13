import { fileURLToPath } from "node:url";

import type { Plugin } from "vite";

import { readDeclarations } from "../../playground/declarations.ts";

const root = fileURLToPath(new URL("../../../..", import.meta.url));
const moduleId = "virtual:json-meta-client-declarations";
const resolvedId = `\0${moduleId}`;

/**
 * Serve the library's declarations to the playground as a virtual module, so
 * the editor gets the same files the package publishes without copying them
 * into the docs.
 */
export function playgroundDeclarations(): Plugin {
  return {
    name: "playground-declarations",
    resolveId(id) {
      return id === moduleId ? resolvedId : undefined;
    },
    async load(id) {
      if (id !== resolvedId) return undefined;
      const declarations = await readDeclarations(root);
      return `export default ${JSON.stringify(declarations)};`;
    },
  };
}
