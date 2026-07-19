import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, expect, it } from "vitest";

import { DaemonController } from "#main/daemon";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..");
const DAEMON_ENTRY = join(REPO_ROOT, "apps", "local-daemon", "dist", "index.js");

/** The daemon skips its HTTP boot when VITEST is set; strip it so the spawned child runs for real. */
function envWithoutVitest(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.VITEST;
  delete env.VITEST_WORKER_ID;
  delete env.VITEST_POOL_ID;
  return env;
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

let dir: string | null = null;

afterEach(() => {
  if (dir !== null) {
    rmSync(dir, { recursive: true, force: true });
    dir = null;
  }
});

it.skipIf(!existsSync(DAEMON_ENTRY))(
  "boots the real daemon, reports healthy, and leaves no process after stop",
  async () => {
    dir = mkdtempSync(join(tmpdir(), "otomat-desktop-"));
    const controller = new DaemonController({
      daemonEntry: DAEMON_ENTRY,
      dbPath: join(dir, "otomat.db"),
      projectRoot: dir,
      userPath: process.env.PATH ?? "",
      packaged: false,
      electronBinary: process.execPath,
      baseEnv: envWithoutVitest(),
    });

    const url = await controller.start();
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    const pid = controller.pid;
    if (pid === undefined) throw new Error("Daemon did not expose its process id");

    const health = await fetch(`${url}/api/health`);
    expect(health.ok).toBe(true);
    expect(await health.json()).toMatchObject({ status: "ok" });

    await controller.stop();
    expect(controller.running).toBe(false);
    expect(isAlive(pid)).toBe(false);
  },
  30_000,
);
