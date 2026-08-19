import { rmSync } from "node:fs";
import { join } from "node:path";

import { DATABASE_INITIALIZED_MARKER_SUFFIX, type PreviewSandboxResetResult } from "@otomat/domain";

import { prepareDataDirectory, type ManagedDataDirectory } from "../data-safety/index.js";
import { runSshScript } from "../remote/ssh/script.js";
import {
  parseSandboxRepoOutput,
  readSandboxTemplate,
  sandboxRepoScript,
  type SandboxRepoOutcome,
} from "./remote-repo.js";
import { seedSandbox } from "./seed.js";
import { ensureTestRepo } from "./test-repo.js";

const SANDBOX_REPO_DIRECTORY = "test-repo";
const REMOTE_SCRIPT_TIMEOUT_MS = 30_000;

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
  /** `~`-relative home of this preview's own instance on the host; its sandbox lives inside it. */
  remoteHomeSuffix: string;
  log(message: string): void;
  fetchImpl?: typeof fetch;
  runScript?: typeof runSshScript;
}

/**
 * The preview build's disposable test bed: a fixture repository plus seeded issues, brought up
 * at boot and rebuilt from scratch on reset so every test session starts from a known state.
 */
export class PreviewSandbox {
  private resetting = false;
  private remote: { alias: string; done: Promise<void> } | null = null;

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

  /** The manager announces every `connected` status, so the per-alias memo collapses repeats. */
  ensureRemote(alias: string, daemonUrl: string): Promise<void> {
    if (!this.deps.enabled) return Promise.resolve();
    const pending = this.remote;
    if (pending !== null && pending.alias === alias) return pending.done;
    const done = this.ensureRemoteNow(alias, daemonUrl).catch((error: unknown) => {
      if (this.remote?.alias === alias) this.remote = null;
      this.deps.log(`Remote sandbox setup failed: ${String(error)}`);
    });
    this.remote = { alias, done };
    return done;
  }

  private async ensureRemoteNow(alias: string, daemonUrl: string): Promise<void> {
    const script = sandboxRepoScript(
      this.deps.remoteHomeSuffix,
      readSandboxTemplate(this.deps.templateDir),
    );
    const result = await (this.deps.runScript ?? runSshScript)({
      alias,
      script,
      timeoutMs: REMOTE_SCRIPT_TIMEOUT_MS,
    });
    if (result.code !== 0) {
      throw new Error(`ssh exited with code ${String(result.code)}: ${result.stderr.trim()}`);
    }
    const outcome = parseSandboxRepoOutput(result.stdout);
    if (outcome === null) throw new Error("The remote sandbox script reported nothing.");
    if (outcome.kind !== "ready") throw new Error(describeRemoteFailure(outcome));
    const seeded = await seedSandbox({
      daemonUrl,
      repoPath: outcome.path,
      realpath: (path) => path,
      fetchImpl: this.deps.fetchImpl,
    });
    this.deps.log(
      seeded.seeded
        ? `Remote sandbox ready at ${outcome.path}: ${seeded.issues} issues.`
        : `Remote sandbox already seeded at ${outcome.path}.`,
    );
  }

  async reset(): Promise<PreviewSandboxResetResult> {
    if (!this.deps.enabled) {
      return { ok: false, message: "Sandbox reset is only available in preview builds." };
    }
    if (this.resetting) return { ok: false, message: "A reset is already running." };
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
      fetchImpl: this.deps.fetchImpl,
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

function describeRemoteFailure(outcome: Exclude<SandboxRepoOutcome, { kind: "ready" }>): string {
  return outcome.kind === "git_missing"
    ? "The host has no `git`; install it to give this instance a sandbox repository."
    : `The host could not create the sandbox repository: ${outcome.detail}`;
}
