import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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

it.skipIf(!existsSync(DAEMON_ENTRY))(
  "surfaces a structured corruption diagnostic without replacing the database",
  async () => {
    dir = mkdtempSync(join(tmpdir(), "otomat-desktop-corrupt-"));
    const dbPath = join(dir, "otomat.db");
    const corruptBytes = Buffer.from("not a sqlite database");
    writeFileSync(dbPath, corruptBytes);
    const controller = new DaemonController({
      daemonEntry: DAEMON_ENTRY,
      dbPath,
      projectRoot: dir,
      userPath: process.env.PATH ?? "",
      packaged: false,
      electronBinary: process.execPath,
      baseEnv: envWithoutVitest(),
    });

    await expect(controller.start()).rejects.toMatchObject({
      diagnostic: expect.objectContaining({ code: "database_corrupt" }),
    });
    expect(controller.running).toBe(false);
    expect(readFileSync(dbPath)).toEqual(corruptBytes);
  },
  30_000,
);

it.skipIf(!existsSync(DAEMON_ENTRY))(
  "restores a confirmed backup through maintenance mode and restarts with the saved data",
  async () => {
    dir = mkdtempSync(join(tmpdir(), "otomat-desktop-restore-"));
    const dbPath = join(dir, "otomat.db");
    const controller = new DaemonController({
      daemonEntry: DAEMON_ENTRY,
      dbPath,
      projectRoot: dir,
      userPath: process.env.PATH ?? "",
      packaged: false,
      electronBinary: process.execPath,
      baseEnv: envWithoutVitest(),
    });

    const firstUrl = await controller.start();
    const before = await fetch(`${firstUrl}/api/issues`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: "local-default", title: "Before backup" }),
    });
    expect(before.status).toBe(201);
    await controller.stop();

    const backupsDir = join(dir, "backups");
    mkdirSync(backupsDir);
    const backupPath = join(
      backupsDir,
      "otomat-backup-2026-07-23T10-00-00.000Z-123e4567-e89b-42d3-a456-426614174000.sqlite",
    );
    copyFileSync(dbPath, backupPath);

    const secondUrl = await controller.start();
    const after = await fetch(`${secondUrl}/api/issues`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: "local-default", title: "After backup" }),
    });
    expect(after.status).toBe(201);
    await controller.stop();

    await controller.restoreBackup(backupPath);
    const restoredUrl = await controller.start();
    const issues = (await (await fetch(`${restoredUrl}/api/issues`)).json()) as {
      title: string;
    }[];
    expect(issues.map((issue) => issue.title)).toContain("Before backup");
    expect(issues.map((issue) => issue.title)).not.toContain("After backup");
    await controller.stop();
  },
  60_000,
);
