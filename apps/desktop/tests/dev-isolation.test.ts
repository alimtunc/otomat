import { dirname, join, sep } from "node:path";

import { expect, it, vi } from "vitest";

import { resolveDevDataRoot } from "#main/dev-data-root";
import type { AppPaths } from "#main/paths";
import { createDesktopRuntime } from "#main/runtime";
import { buildDaemonEnv } from "#shared/daemon-env";
import { scratchDir } from "#support/scratch-dir";

vi.mock("electron", () => ({
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: () => Buffer.alloc(0),
    decryptString: () => "",
  },
}));

function devPaths(devDataRoot: string): AppPaths {
  return {
    packaged: false,
    daemonEntry: "/nonexistent/daemon/index.js",
    webDist: null,
    splashHtml: "/nonexistent/splash.html",
    sandboxTemplateDir: "/tmp/otomat-sandbox-template",
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
function daemonStorage(env: NodeJS.ProcessEnv) {
  const dbPath = env.OTOMAT_DB_PATH;
  if (dbPath === undefined) throw new Error("The daemon environment carries no database path.");
  expect(env.OTOMAT_WORKTREES_ROOT).toBeUndefined();
  const dataDir = dirname(dbPath);
  return { dataDir, runs: join(dataDir, "runs"), worktrees: join(dataDir, "worktrees") };
}

function sessionFor(worktree: string, appData: string) {
  const root = resolveDevDataRoot({ repoRoot: worktree, appData, env: {} });
  const runtime = createDesktopRuntime({
    paths: devPaths(root),
    userData: root,
    userPath: "/usr/bin",
    expectedBuild: null,
    channel: "dev",
    version: "0.0.0",
    installability: { installable: false, reason: "a checkout" },
    updaterPort: {
      check: async () => null,
      download: async () => {},
      quitAndInstall: () => {},
      onProgress: () => {},
    },
    localDaemonUrl: () => "",
    onRemoteStatus: () => {},
    onLinearDelivery: () => {},
    onUpdate: () => {},
    applyRendererUrl: async () => {},
    onSandboxDaemonStarted: () => {},
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

it("gives two dev worktrees disjoint databases, run files, and generated git worktrees", () => {
  const appData = scratchDir("otomat-appdata-");
  const first = sessionFor(scratchDir("otomat-worktree-a-"), appData);
  const second = sessionFor(scratchDir("otomat-worktree-b-"), appData);

  const firstStorage = daemonStorage(first.env);
  const secondStorage = daemonStorage(second.env);

  expect(firstStorage.dataDir).toBe(first.root);
  expect(secondStorage.dataDir).toBe(second.root);
  expect(first.env.OTOMAT_DB_PATH).not.toBe(second.env.OTOMAT_DB_PATH);
  expect(firstStorage.runs).not.toBe(secondStorage.runs);
  expect(firstStorage.worktrees).not.toBe(secondStorage.worktrees);
});

it("keeps every daemon artifact inside the session's own dev root", () => {
  const appData = scratchDir("otomat-appdata-");
  const worktree = scratchDir("otomat-worktree-");
  const session = sessionFor(worktree, appData);
  const storage = daemonStorage(session.env);

  for (const path of [session.env.OTOMAT_DB_PATH, storage.runs, storage.worktrees]) {
    expect(path?.startsWith(`${session.root}${sep}`)).toBe(true);
    expect(path?.startsWith(`${worktree}${sep}`)).toBe(false);
    expect(path?.startsWith(AMBIENT_WORKTREES_ROOT)).toBe(false);
  }
  expect(session.env.OTOMAT_PROJECT_ROOT).toBe(session.root);
});
