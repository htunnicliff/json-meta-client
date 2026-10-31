import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/__test__/integration/**/*.test.ts"],
    environment: "node",
    globalSetup: ["./src/__test__/integration/setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
