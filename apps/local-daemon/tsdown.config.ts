import { execSync } from "node:child_process";

import { defineConfig } from "tsdown";

// The dist self-identifies its commit so a deployed daemon can be compared to
// the app connecting to it; a build outside git stays unstamped.
function buildSha(): string | null {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
}

const sha = buildSha();

// Bundle the daemon to a runnable dist. Internal modules (#api/#events/#git/#runtime)
// are inlined; node_modules dependencies (incl. the native better-sqlite3 and the
// @otomat/* workspace packages) stay external and resolve at runtime.
export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  platform: "node",
  dts: false,
  ...(sha === null ? {} : { define: { "process.env.OTOMAT_BUILD_SHA": JSON.stringify(sha) } }),
  // tsdown >=0.16 defaults platform:node ESM output to .mjs; pin .js so the
  // `start:dist` script and scripts/smoke-dist.mjs keep resolving dist/index.js.
  outExtensions: () => ({ js: ".js" }),
});
