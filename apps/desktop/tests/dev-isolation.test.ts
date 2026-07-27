import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, sep } from "node:path";

import { afterEach, expect, it, vi } from "vitest";

import { createDesktopRuntime } from "#main/desktop-runtime";
import { resolveDevDataRoot } from "#main/dev-data-root";
import type { AppPaths } from "#main/paths";
import { buildDaemonEnv } from "#shared/daemon-env";

vi.mock("electron", () => ({
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: () => Buffer.alloc(0),
    decryptString: () => "",
  },
}));

const scratchDirs: string[] = [];

function scratch(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  scratchDirs.push(dir);
  return dir;
}

function devPaths(devDataRoot: string): AppPaths {
  return {
    packaged: false,
    daemonEntry: "/nonexistent/daemon/index.js",
    webDist: null,
    splashHtml: "/nonexistent/splash.html",
    cockpitPreload: "/nonexistent/cockpit.cjs",
    splashPreload: "/nonexistent/splash.cjs",
    devDataRoot,
  };
}

/** A shared root a developer's shell might export; no session may inherit it. */
const AMBIENT_WORKTREES_ROOT = "/shared/ambient/worktrees";

/**
 * What the daemon derives from `OTOMAT_DB_PATH` (`apps/local-daemon/src/server.ts`): its data dir,
 * and under it runs + worktrees. Only valid while the env carries no `OTOMAT_WORKTREES_ROOT`, which
 * every caller asserts first.
 */
function daemonStorage(env: NodeJS.ProcessEnv): {
  dataDir: string;
  runs: string;
  worktrees: string;
} {
  const dbPath = env.OTOMAT_DB_PATH;
  if (dbPath === undefined) throw new Error("The daemon environment carries no database path.");
  expect(env.OTOMAT_WORKTREES_ROOT).toBeUndefined();
  const dataDir = dirname(dbPath);
  return { dataDir, runs: join(dataDir, "runs"), worktrees: join(dataDir, "worktrees") };
}

function sessionFor(worktree: string, appData: string): { root: string; env: NodeJS.ProcessEnv } {
  const root = resolveDevDataRoot({ repoRoot: worktree, appData, env: {} });
  const runtime = createDesktopRuntime({
    paths: devPaths(root),
    userData: root,
    userPath: "/usr/bin",
    daemonUrl: () => "",
  });
  expect(runtime.dataDirectory.root).toBe(root);
  return {
    root,
    env: buildDaemonEnv({
      port: 51_234,
      dbPath: runtime.dataDirectory.dbPath,
      projectRoot: runtime.dataDirectory.root,
      path: "/usr/bin",
      baseEnv: { OTOMAT_WORKTREES_ROOT: AMBIENT_WORKTREES_ROOT },
    }),
  };
}

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

it("gives two dev worktrees disjoint databases, run files, and generated git worktrees", () => {
  const appData = scratch("otomat-appdata-");
  const first = sessionFor(scratch("otomat-worktree-a-"), appData);
  const second = sessionFor(scratch("otomat-worktree-b-"), appData);

  const firstStorage = daemonStorage(first.env);
  const secondStorage = daemonStorage(second.env);

  expect(firstStorage.dataDir).toBe(first.root);
  expect(secondStorage.dataDir).toBe(second.root);
  expect(first.env.OTOMAT_DB_PATH).not.toBe(second.env.OTOMAT_DB_PATH);
  expect(firstStorage.runs).not.toBe(secondStorage.runs);
  expect(firstStorage.worktrees).not.toBe(secondStorage.worktrees);
});

it("keeps every daemon artifact inside the session's own dev root", () => {
  const appData = scratch("otomat-appdata-");
  const worktree = scratch("otomat-worktree-");
  const session = sessionFor(worktree, appData);
  const storage = daemonStorage(session.env);

  for (const path of [session.env.OTOMAT_DB_PATH, storage.runs, storage.worktrees]) {
    expect(path?.startsWith(`${session.root}${sep}`)).toBe(true);
    expect(path?.startsWith(`${worktree}${sep}`)).toBe(false);
    expect(path?.startsWith(AMBIENT_WORKTREES_ROOT)).toBe(false);
  }
  expect(session.env.OTOMAT_PROJECT_ROOT).toBe(session.root);
});
