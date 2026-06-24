import { defineConfig } from "tsdown";

// Bundle the daemon to a runnable dist. Internal modules (#api/#events/#git/#runtime)
// are inlined; node_modules dependencies (incl. the native better-sqlite3 and the
// @otomat/* workspace packages) stay external and resolve at runtime.
export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  platform: "node",
  dts: false,
  // tsdown >=0.16 defaults platform:node ESM output to .mjs; pin .js so the
  // `start:dist` script and scripts/smoke-dist.mjs keep resolving dist/index.js.
  outExtensions: () => ({ js: ".js" }),
});
