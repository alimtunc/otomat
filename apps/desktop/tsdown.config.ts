import { defineConfig } from "tsdown";

// Two outputs with different module systems:
//  - the main process is ESM (Electron >=28 loads an ESM entry), with @otomat/domain + zod
//    inlined (they are devDependencies, so tsdown bundles them by default) so the packaged
//    app.asar needs no node_modules for the shell itself;
//  - preloads are CommonJS (the reliable format for a preload script).
// `electron` is always external — the runtime provides it; node builtins stay external too.
export default defineConfig([
  {
    entry: { "main/index": "src/main/index.ts" },
    format: "esm",
    platform: "node",
    dts: false,
    deps: { neverBundle: ["electron"] },
    outExtensions: () => ({ js: ".js" }),
  },
  {
    entry: {
      "preload/cockpit": "src/preload/cockpit.ts",
      "preload/splash": "src/preload/splash.ts",
    },
    format: "cjs",
    platform: "node",
    dts: false,
    deps: { neverBundle: ["electron"] },
    outExtensions: () => ({ js: ".cjs" }),
  },
]);
