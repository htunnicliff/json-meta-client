import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    typecheck: {
      enabled: true,
      ignoreSourceErrors: true,
      tsconfig: "./tsconfig.typecheck.json",
    },
  },
});
