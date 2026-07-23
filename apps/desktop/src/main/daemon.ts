import { spawn, type ChildProcess } from "node:child_process";

import {
  MAINTENANCE_ACTION_ENV,
  MAINTENANCE_RESTORE_ACTION,
  RESTORE_BACKUP_ENV,
  type DesktopStartupDiagnostic,
} from "@otomat/domain";

import { APP_ORIGIN, DAEMON_HOST, DAEMON_TERMINATE_GRACE_MS } from "#shared/constants";
import { buildDaemonEnv } from "#shared/daemon-env";
import { waitForHealth } from "#shared/health";
import { findFreeLoopbackPort } from "#shared/ports";
import { terminateChild } from "#shared/terminate";

import { DaemonOutputCapture } from "./data-safety/daemon-output.js";
import { combineFailures } from "./data-safety/failure-composition.js";

export interface DaemonControllerOptions {
  /** Node entry to run (packaged bundle, or the repo's built dist in dev). */
  daemonEntry: string;
  /** SQLite path under userData; its dir holds runs + worktrees. */
  dbPath: string;
  projectRoot: string;
  /** Resolved PATH so the daemon finds user CLIs from a Finder launch. */
  userPath: string;
  packaged: boolean;
  /** Electron binary path; used to run the daemon as Node in the packaged app (no standalone node). */
  electronBinary: string;
  /** Env the daemon child extends; defaults to the app's env (tests override to strip inherited VITEST). */
  baseEnv?: NodeJS.ProcessEnv;
  writeLog?: (stream: "stdout" | "stderr", text: string) => void;
}

export class DaemonStartupError extends Error {
  constructor(
    readonly diagnostic: DesktopStartupDiagnostic,
    options?: ErrorOptions,
  ) {
    super(diagnostic.message, options);
    this.name = "DaemonStartupError";
  }
}

interface ActiveChild {
  child: ChildProcess;
  closed: Promise<number | null>;
  output: DaemonOutputCapture;
}

const OUTPUT_DRAIN_TIMEOUT_MS = 1000;

/** Owns the single daemon child: starts it on a fresh loopback port, waits for health, stops it bounded. */
export class DaemonController {
  private active: ActiveChild | null = null;
  private restoreOperation: Promise<void> | null = null;

  constructor(private readonly options: DaemonControllerOptions) {}

  get running(): boolean {
    return this.active !== null;
  }

  get pid(): number | undefined {
    return this.active?.child.pid;
  }

  /** Spawns the daemon, resolves its origin once `/api/health` answers; rejects if it dies or times out. */
  async start(): Promise<string> {
    if (this.restoreOperation !== null) {
      throw new Error("The database restore process is still running.");
    }
    if (this.active !== null) throw new Error("The local daemon is already running.");
    const port = await findFreeLoopbackPort();
    const env = buildDaemonEnv({
      port,
      dbPath: this.options.dbPath,
      projectRoot: this.options.projectRoot,
      path: this.options.userPath,
      allowedOrigin: this.options.packaged ? APP_ORIGIN : undefined,
      baseEnv: this.options.baseEnv ?? process.env,
      runAsNode: this.options.packaged,
    });
    const command = this.options.packaged ? this.options.electronBinary : "node";
    const child = spawn(command, [this.options.daemonEntry], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const active = this.trackChild(child);

    const deadDuringBoot = new AbortController();
    let spawnError: Error | null = null;
    const onEarlyExit = (): void => deadDuringBoot.abort();
    const onSpawnError = (error: Error): void => {
      spawnError = error;
      deadDuringBoot.abort();
    };
    child.once("exit", onEarlyExit);
    child.once("error", onSpawnError);
    try {
      await waitForHealth({
        url: `http://${DAEMON_HOST}:${port}/api/health`,
        signal: deadDuringBoot.signal,
      });
    } catch (error) {
      child.off("exit", onEarlyExit);
      child.off("error", onSpawnError);
      let cleanupFailure: unknown = null;
      try {
        await this.stopActive(active);
      } catch (stopError) {
        cleanupFailure = stopError;
      }
      const startupFailure = spawnError ?? error;
      const cause = combineFailures(
        cleanupFailure === null ? [startupFailure] : [startupFailure, cleanupFailure],
        "Daemon startup and process cleanup both failed.",
      );
      if (active.output.diagnostic !== null) {
        throw new DaemonStartupError(active.output.diagnostic, { cause });
      }
      throw cause;
    }
    child.off("exit", onEarlyExit);
    child.off("error", onSpawnError);
    return `http://${DAEMON_HOST}:${port}`;
  }

  async restoreBackup(backupPath: string): Promise<void> {
    if (this.restoreOperation !== null) return this.restoreOperation;
    const operation = this.runRestoreProcess(backupPath).finally(() => {
      if (this.restoreOperation === operation) this.restoreOperation = null;
    });
    this.restoreOperation = operation;
    return operation;
  }

  private async runRestoreProcess(backupPath: string): Promise<void> {
    await this.stop();
    const env = buildDaemonEnv({
      port: 0,
      dbPath: this.options.dbPath,
      projectRoot: this.options.projectRoot,
      path: this.options.userPath,
      allowedOrigin: this.options.packaged ? APP_ORIGIN : undefined,
      baseEnv: this.options.baseEnv ?? process.env,
      runAsNode: this.options.packaged,
    });
    env[MAINTENANCE_ACTION_ENV] = MAINTENANCE_RESTORE_ACTION;
    env[RESTORE_BACKUP_ENV] = backupPath;
    const command = this.options.packaged ? this.options.electronBinary : "node";
    const child = spawn(command, [this.options.daemonEntry], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const active = this.trackChild(child);
    let spawnError: Error | null = null;
    child.once("error", (error) => {
      spawnError = error;
    });
    const code = await active.closed;
    if (this.active === active) this.active = null;
    if (spawnError !== null) throw spawnError;
    if (code === 0) return;
    if (active.output.diagnostic !== null) {
      throw new DaemonStartupError(active.output.diagnostic);
    }
    throw new Error(`Database restore process exited with code ${String(code)}.`);
  }

  /** SIGTERM (its own handler settles runs + reaps workers) then SIGKILL after the grace; never leaves the daemon orphaned. */
  async stop(): Promise<void> {
    const active = this.active;
    if (active === null) return;
    await this.stopActive(active);
  }

  private trackChild(child: ChildProcess): ActiveChild {
    const output = new DaemonOutputCapture(this.options.writeLog);
    const active = { child, output, closed: output.attach(child) };
    this.active = active;
    return active;
  }

  private async stopActive(active: ActiveChild): Promise<void> {
    let terminationFailure: unknown = null;
    try {
      await terminateChild(active.child, DAEMON_TERMINATE_GRACE_MS);
    } catch (error) {
      terminationFailure = error;
    }
    let drainTimer: ReturnType<typeof setTimeout> | null = null;
    const drained = await Promise.race([
      active.closed.then(() => true),
      new Promise<false>((resolve) => {
        drainTimer = setTimeout(() => resolve(false), OUTPUT_DRAIN_TIMEOUT_MS);
      }),
    ]);
    if (drainTimer !== null) clearTimeout(drainTimer);
    if (terminationFailure !== null) {
      if (drained && this.active === active) this.active = null;
      throw terminationFailure;
    }
    if (!drained) active.output.detachAndFlush(active.child);
    if (this.active === active) this.active = null;
  }
}
