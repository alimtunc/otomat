import { rmSync } from "node:fs";
import { join } from "node:path";

import { DATABASE_INITIALIZED_MARKER_SUFFIX, type PreviewSandboxResetResult } from "@otomat/domain";

import { prepareDataDirectory, type ManagedDataDirectory } from "../data-safety/index.js";
import { seedSandbox } from "./seed.js";
import { ensureTestRepo } from "./test-repo.js";

const SANDBOX_REPO_DIRECTORY = "test-repo";

export const SANDBOX_NOT_READY: PreviewSandboxResetResult = {
  ok: false,
  message: "The app is still starting; try again shortly.",
};

/** The slice of the daemon controller a reset needs; `DaemonController` satisfies it. */
export interface SandboxDaemon {
  readonly running: boolean;
  stop(): Promise<void>;
  start(): Promise<string>;
}

export interface PreviewSandboxDeps {
  /** True only for packaged preview builds; every entry point is a refusing no-op otherwise. */
  enabled: boolean;
  dataDirectory: ManagedDataDirectory;
  /** Template the fixture repository is created from (`AppPaths.sandboxTemplateDir`). */
  templateDir: string;
  daemon: SandboxDaemon;
  /** Re-points the renderer at the restarted daemon whenever a reset started one. */
  onDaemonStarted(url: string): void;
  log(message: string): void;
  fetchImpl?: typeof fetch;
}

/**
 * The preview build's disposable test bed: a fixture repository plus seeded issues, brought up
 * at boot and rebuilt from scratch on reset so every test session starts from a known state.
 */
export class PreviewSandbox {
  private resetting = false;

  constructor(private readonly deps: PreviewSandboxDeps) {}

  /** Boot-time entry: a seeding failure degrades to a log line, never a blocked startup. */
  async ensure(daemonUrl: string): Promise<void> {
    if (!this.deps.enabled) return;
    try {
      await this.ensureNow(daemonUrl);
    } catch (error) {
      this.deps.log(`Preview sandbox setup failed: ${String(error)}`);
    }
  }

  async reset(): Promise<PreviewSandboxResetResult> {
    if (!this.deps.enabled) {
      return { ok: false, message: "Sandbox reset is only available in preview builds." };
    }
    if (this.resetting) return { ok: false, message: "A reset is already running." };
    // No splash-phase operation can be in flight: the cockpit that triggers this only exists
    // after startup finished, and a concurrent reset is refused above.
    this.resetting = true;
    let url: string | null = null;
    try {
      if (this.deps.daemon.running) await this.deps.daemon.stop();
      this.wipe();
      prepareDataDirectory(this.deps.dataDirectory.root);
      url = await this.deps.daemon.start();
      await this.ensureNow(url);
      return { ok: true, message: null };
    } catch (error) {
      this.deps.log(`Sandbox reset failed: ${String(error)}`);
      return {
        ok: false,
        message: error instanceof Error ? error.message : "The sandbox reset failed.",
      };
    } finally {
      if (url !== null) this.deps.onDaemonStarted(url);
      this.resetting = false;
    }
  }

  private async ensureNow(daemonUrl: string): Promise<void> {
    const repoDir = join(this.deps.dataDirectory.root, SANDBOX_REPO_DIRECTORY);
    if (ensureTestRepo(repoDir, this.deps.templateDir)) {
      this.deps.log(`Sandbox repository created at ${repoDir}.`);
    }
    const result = await seedSandbox({
      daemonUrl,
      repoPath: repoDir,
      ...(this.deps.fetchImpl === undefined ? {} : { fetchImpl: this.deps.fetchImpl }),
    });
    if (result.seeded) this.deps.log(`Sandbox fixtures seeded: ${result.issues} issues.`);
  }

  /** Database, runs, worktrees, backups and the fixture repo go; logs, host config and the layout manifest stay. */
  private wipe(): void {
    const directory = this.deps.dataDirectory;
    const targets = [
      directory.dbPath,
      `${directory.dbPath}-wal`,
      `${directory.dbPath}-shm`,
      `${directory.dbPath}${DATABASE_INITIALIZED_MARKER_SUFFIX}`,
      directory.backupsDir,
      join(directory.root, "runs"),
      join(directory.root, "worktrees"),
      join(directory.root, SANDBOX_REPO_DIRECTORY),
    ];
    for (const target of targets) rmSync(target, { recursive: true, force: true });
  }
}
