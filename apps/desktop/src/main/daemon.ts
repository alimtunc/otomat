import { spawn, type ChildProcess } from "node:child_process";

import { APP_ORIGIN, DAEMON_HOST, DAEMON_TERMINATE_GRACE_MS } from "#shared/constants";
import { buildDaemonEnv } from "#shared/daemon-env";
import { waitForHealth } from "#shared/health";
import { findFreeLoopbackPort } from "#shared/ports";
import { terminateChild } from "#shared/terminate";

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
}

/** Owns the single daemon child: starts it on a fresh loopback port, waits for health, stops it bounded. */
export class DaemonController {
  private child: ChildProcess | null = null;

  constructor(private readonly options: DaemonControllerOptions) {}

  get running(): boolean {
    return this.child !== null;
  }

  get pid(): number | undefined {
    return this.child?.pid;
  }

  /** Spawns the daemon, resolves its origin once `/api/health` answers; rejects if it dies or times out. */
  async start(): Promise<string> {
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
    this.child = child;
    child.stdout?.on("data", (chunk) => process.stdout.write(`[daemon] ${chunk}`));
    child.stderr?.on("data", (chunk) => process.stderr.write(`[daemon] ${chunk}`));

    const deadDuringBoot = new AbortController();
    const onEarlyExit = (): void => deadDuringBoot.abort();
    child.once("exit", onEarlyExit);
    try {
      await waitForHealth({
        url: `http://${DAEMON_HOST}:${port}/api/health`,
        signal: deadDuringBoot.signal,
      });
    } catch (error) {
      child.off("exit", onEarlyExit);
      await this.stop();
      throw error;
    }
    child.off("exit", onEarlyExit);
    return `http://${DAEMON_HOST}:${port}`;
  }

  /** SIGTERM (its own handler settles runs + reaps workers) then SIGKILL after the grace; never leaves the daemon orphaned. */
  async stop(): Promise<void> {
    const child = this.child;
    if (child === null) return;
    this.child = null;
    await terminateChild(child, DAEMON_TERMINATE_GRACE_MS);
  }
}
