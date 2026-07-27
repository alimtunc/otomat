// Dev runner for the desktop shell: builds the daemon + desktop main/preload, starts a Vite dev
// server on a port reserved for this session, then launches Electron pointed at that exact URL
// (Electron still spawns and manages the daemon on a free port, against a per-worktree data root).
// The classic two-terminal `pnpm dev` + `pnpm back` flow is untouched.
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { DEV_SERVER_ENV, electronEnv, planDevServer, viteArgs } from "./dev-session.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");
const WEB_DIR = join(REPO_ROOT, "apps", "web");
const VITE_BIN = join(WEB_DIR, "node_modules", ".bin", "vite");
const DEV_SERVER_TIMEOUT_MS = 30_000;

function buildOnce(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: REPO_ROOT, stdio: "inherit" });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`)),
    );
  });
}

async function waitForDevServer(url, timeoutMs, failure) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const dead = failure();
    if (dead !== null) throw new Error(`${url} never came up: ${dead}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The server is not listening yet; the deadline above bounds the wait.
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`dev server ${url} did not come up within ${timeoutMs}ms`);
}

await buildOnce("pnpm", ["--filter", "@otomat/local-daemon", "build"]);
await buildOnce("pnpm", ["--filter", "@otomat/desktop", "build"]);

const plan = await planDevServer({ env: process.env });

let vite = null;
let viteFailure = null;
if (plan.managed) {
  vite = spawn(VITE_BIN, viteArgs(plan.port), { cwd: WEB_DIR, stdio: "inherit" });
  vite.on("exit", (code) => (viteFailure = `vite exited with code ${code}`));
  vite.on("error", (error) => (viteFailure = `vite could not be started: ${error.message}`));
} else {
  console.log(`[otomat-desktop] using the ${DEV_SERVER_ENV} override at ${plan.url}`);
}
function stopVite() {
  vite?.kill("SIGTERM");
}
try {
  await waitForDevServer(plan.url, DEV_SERVER_TIMEOUT_MS, () => viteFailure);
} catch (error) {
  stopVite();
  throw error;
}
console.log(`[otomat-desktop] dev server ready at ${plan.url}`);

const electron = spawn("pnpm", ["--filter", "@otomat/desktop", "exec", "electron", "."], {
  cwd: REPO_ROOT,
  stdio: "inherit",
  env: electronEnv(process.env, plan.url),
});

electron.on("exit", (code) => {
  stopVite();
  process.exit(code ?? 0);
});

// Leaving Vite behind would hold this session's reserved port against the next run.
function shutdown() {
  electron.kill("SIGTERM");
  stopVite();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
