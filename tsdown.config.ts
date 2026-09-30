import { rm } from "node:fs/promises";
import { join } from "node:path";

import { defineConfig } from "tsdown";

import { emitRfcDeclarations } from "./scripts/rfc-declarations.ts";

export default defineConfig(async () => {
  const declarations = await emitRfcDeclarations();
  return {
    entry: ["src/index.ts", "src/capabilities/index.ts", "src/capabilities/community/index.ts"],
    dts: {
      sourcemap: true,
      resolver: "tsc",
      compilerOptions: {
        paths: {
          "jmap-rfc-types": [join(declarations, "index.d.ts")],
          "jmap-rfc-types/contracts": [join(declarations, "contracts", "index.d.ts")],
        },
      },
    },
    publint: true,
    sourcemap: true,
    attw: {
      profile: "esm-only",
    },
    target: ["esnext"],
    minify: {
      compress: { keepNames: { function: true, class: true } },
      mangle: { keepNames: true },
    },
    deps: { alwaysBundle: ["jmap-rfc-types"] },
    alias: {
      "jmap-rfc-types/contracts": join(declarations, "contracts", "index.d.ts"),
      "jmap-rfc-types": join(declarations, "index.d.ts"),
    },
    onSuccess: async () => {
      await rm(declarations, { recursive: true, force: true });
    },
  };
});
