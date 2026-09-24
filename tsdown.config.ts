import { defineConfig } from "tsdown";

export default defineConfig({
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
