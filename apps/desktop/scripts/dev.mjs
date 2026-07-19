// Dev runner for the desktop shell: builds the daemon + desktop main/preload, starts the Vite
// dev server, then launches Electron pointed at it (Electron still spawns and manages the daemon
// on a free port). The classic two-terminal `pnpm dev` + `pnpm back` flow is untouched.
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");
const DEV_SERVER = process.env.OTOMAT_DESKTOP_DEV_SERVER ?? "http://localhost:5173";

function buildOnce(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: REPO_ROOT, stdio: "inherit" });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`)),
    );
  });
}

async function waitFor(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error(`dev server ${url} did not come up within ${timeoutMs}ms`);
}

await buildOnce("pnpm", ["--filter", "@otomat/local-daemon", "build"]);
await buildOnce("pnpm", ["--filter", "@otomat/desktop", "build"]);

const vite = spawn("pnpm", ["--filter", "@otomat/web", "dev"], {
  cwd: REPO_ROOT,
  stdio: "inherit",
});
await waitFor(DEV_SERVER, 30_000);

const electron = spawn("pnpm", ["--filter", "@otomat/desktop", "exec", "electron", "."], {
  cwd: REPO_ROOT,
  stdio: "inherit",
  env: { ...process.env, OTOMAT_DESKTOP_DEV_SERVER: DEV_SERVER },
});

function shutdown() {
  electron.kill("SIGTERM");
  vite.kill("SIGTERM");
}
electron.on("exit", () => {
  vite.kill("SIGTERM");
  process.exit(0);
});
process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});
