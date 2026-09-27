import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/capabilities/index.ts"],
  dts: {
    sourcemap: true,
  },
  publint: true,
  sourcemap: true,
  attw: {
    profile: "esm-only",
  },
  target: ["esnext"],
  minify: true,
});
