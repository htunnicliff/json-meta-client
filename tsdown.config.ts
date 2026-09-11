import { defineConfig } from "tsdown";

export default defineConfig({
  dts: true,
  publint: true,
  attw: {
    profile: "esm-only",
  },
});
