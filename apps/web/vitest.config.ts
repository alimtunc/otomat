import { resolve } from "node:path";

import base from "@otomat/tooling/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  defineConfig(base),
  defineConfig({
    resolve: {
      alias: { "@web": resolve(import.meta.dirname, "src") },
    },
  }),
);
