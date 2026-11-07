import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["lib/finance/**", "lib/flags/**", "lib/extraction/redact.ts", "lib/extraction/schema.ts"],
    },
  },
});
