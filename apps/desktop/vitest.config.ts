import base from "@otomat/tooling/vitest";
import { defineConfig } from "vitest/config";

// The dev runner and the release tooling are plain ESM run by node, so their tests are `.mjs`.
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: [...base.test.include, "tests/**/*.test.mjs"],
    testTimeout: 10_000,
  },
});
