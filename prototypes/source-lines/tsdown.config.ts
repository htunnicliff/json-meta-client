import { defineConfig } from "tsdown";

// PROTOTYPE (#201): bundle the worker with everything inlined.
export default defineConfig({
  entry: { worker: "worker.ts" },
  outDir: "dist",
  format: "esm",
  platform: "browser",
  minify: true,
  dts: false,
  clean: true,
  publint: false,
  attw: false,
  exports: false,
  banner: "",
  deps: { alwaysBundle: [/.*/] },
});
