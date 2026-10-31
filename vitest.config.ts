import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["src/__test__/integration/**"],
    environment: "node",
    typecheck: {
      enabled: true,
      tsconfig: "./tsconfig.typecheck.json",
    },
  },
});
