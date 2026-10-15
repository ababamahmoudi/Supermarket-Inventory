import { defineConfig } from "vitest/config";

// Retained SDK cases use real repository/official fake-indexeddb semantics.
// They do not run the DOM-only React test setup or a substitute SDK graph.
export default defineConfig({
  test: {
    environment: "node",
    setupFiles: [],
    include: ["src/e1-authority/**/*.test.mjs"],
    maxWorkers: 1,
    fileParallelism: false,
    restoreMocks: true,
    clearMocks: true,
    testTimeout: 30000,
  },
});
