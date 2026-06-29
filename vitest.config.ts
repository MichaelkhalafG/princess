import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Unit/integration tests run in Node. `@/` mirrors the tsconfig path alias so
// tests import modules the same way app code does.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // `server-only` throws outside Next's react-server condition; stub it so
      // unit tests can import server-only modules (lib/payments, lib/notifications).
      "server-only": fileURLToPath(new URL("./tests/setup/server-only-stub.ts", import.meta.url)),
    },
  },
});
