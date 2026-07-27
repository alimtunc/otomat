import base from "@otomat/tooling/vitest";
import { defineConfig } from "vitest/config";

// The dev runner is plain JS (it runs before anything is built), so its tests are too.
export default defineConfig({
  ...base,
  test: { ...base.test, include: [...base.test.include, "tests/**/*.test.mjs"] },
});
