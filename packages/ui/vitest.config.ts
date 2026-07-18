import { resolve } from "node:path";

import base from "@otomat/tooling/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  defineConfig(base),
  defineConfig({
    resolve: {
      alias: { "@otomat/ui": resolve(import.meta.dirname, "src/index.ts") },
    },
    test: {
      include: ["tests/**/*.test.{ts,tsx}"],
    },
  }),
);
