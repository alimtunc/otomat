import base from "@otomat/tooling/vitest";
import { defineConfig } from "vitest/config";

export default defineConfig({
  ...base,
  test: { ...base.test, testTimeout: 10_000 },
});
