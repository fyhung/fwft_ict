import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "threads",
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
