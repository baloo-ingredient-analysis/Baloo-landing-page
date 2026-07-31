import { defineConfig } from "vitest/config";

// Test setup (first scaffolded alongside the engineering guide). Scoped to lib/ for now — the pure,
// framework-agnostic layer is where unit tests earn the most for the least infra. Query-integration
// (against a throwaway Postgres) and Playwright smoke tests are the planned next steps.
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
