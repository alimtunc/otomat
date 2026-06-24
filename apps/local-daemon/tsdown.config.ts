import { defineConfig } from "tsdown";

// Bundle the daemon to a runnable dist. Internal modules (#api/#events/#git/#runtime)
// are inlined; node_modules dependencies (incl. the native better-sqlite3 and the
// @otomat/* workspace packages) stay external and resolve at runtime.
export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  platform: "node",
  dts: false,
});
