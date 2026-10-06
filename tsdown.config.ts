import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  dts: {
    generator: "tsc",
    sourcemap: true,
  },
  publint: true,
  sourcemap: true,
  attw: true,
  target: ["esnext"],
  minify: true,
});
