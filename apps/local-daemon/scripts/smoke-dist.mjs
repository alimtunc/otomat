// Smoke test for the bundled daemon: boot `node dist/index.js` against a throwaway
// DB, confirm it serves /api/health, then shut it down. Guards against shipping a
// dist that only runs under `tsx src`. Run after `pnpm --filter @otomat/local-daemon build`.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 43190;
const dir = mkdtempSync(join(tmpdir(), "otomat-smoke-"));
const childEnv = {
  ...process.env,
  OTOMAT_DAEMON_PORT: String(PORT),
  OTOMAT_DB_PATH: join(dir, "smoke.db"),
  OTOMAT_PROJECT_ROOT: dir,
};
delete childEnv.OTOMAT_LINEAR_API_KEY;
const child = spawn(process.execPath, ["dist/index.js"], {
  env: childEnv,
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
child.stdout.on("data", (d) => (output += d));
child.stderr.on("data", (d) => (output += d));

async function waitForHealth(deadlineMs) {
  const start = Date.now();
  while (Date.now() - start < deadlineMs) {
    try {
      const res = await fetch(`http://localhost:${PORT}/api/health`);
      if (res.ok) return await res.json();
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`health check timed out after ${deadlineMs}ms`);
}

let code = 0;
try {
  const body = await waitForHealth(10_000);
  if (body.status !== "ok") throw new Error(`unexpected health body: ${JSON.stringify(body)}`);
  console.log(`smoke ok: node dist/index.js healthy on :${PORT} -> ${JSON.stringify(body)}`);
} catch (error) {
  code = 1;
  console.error(`smoke FAILED: ${error.message}`);
  console.error(`daemon output:\n${output}`);
} finally {
  child.kill("SIGTERM");
  rmSync(dir, { recursive: true, force: true });
  process.exit(code);
}
