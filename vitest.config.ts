import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          exclude: ["src/__test__/integration/**"],
          environment: "node",
          typecheck: {
            enabled: true,
            tsconfig: "./tsconfig.typecheck.json",
          },
        },
      },
      {
        test: {
          name: "integration",
          include: ["src/__test__/integration/**/*.test.ts"],
          environment: "node",
          globalSetup: ["./src/__test__/integration/setup.ts"],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
