import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

import { releaseWorkerStart, WORKER_START_TOKEN_ENV } from "./start-gate.js";
import {
  WORKER_JOB_ENV,
  type ProcessExit,
  type SessionProcess,
  type SupervisedJob,
} from "./types.js";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref();
  });
}

/** Sends `SIGTERM`, waits up to `graceMs` for exit, then escalates to `SIGKILL`. Resolves only once the process has actually exited. */
export async function terminateGracefully(proc: SessionProcess, graceMs: number): Promise<void> {
  proc.kill("SIGTERM");
  const exitedInTime = await Promise.race([
    proc.exited.then(() => true),
    delay(graceMs).then(() => false),
  ]);
  if (!exitedInTime) {
    proc.kill("SIGKILL");
    await proc.exited;
  }
}

// kill(pid, 0) only probes: ESRCH = gone, EPERM = alive under another uid; pid <= 1 rejects the kill(0)/kill(-1)/init sentinels.
export function isProcessAlive(pid: number): boolean {
  if (pid <= 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

// kill(-pgid) signals the whole detached group; pgid <= 1 guards init, kill(-0), and the -1 spawn-failure sentinel.
export function killProcessGroup(pgid: number, signal: NodeJS.Signals): void {
  if (pgid <= 1) return;
  try {
    process.kill(-pgid, signal);
  } catch {
    // ESRCH: group already gone.
  }
}

// Re-execs the daemon entrypoint detached into its own group so the child outlives a daemon crash; execArgv carries dev loader flags so it works from src and dist.
export function createReexecSpawn(mainScript: string): (job: SupervisedJob) => SessionProcess {
  return (job) => {
    const startToken = randomUUID();
    const child = spawn(process.execPath, [...process.execArgv, mainScript], {
      env: {
        ...process.env,
        [WORKER_JOB_ENV]: JSON.stringify(job),
        [WORKER_START_TOKEN_ENV]: startToken,
      },
      detached: true,
      stdio: "ignore",
    });
    child.unref();

    const pid = child.pid ?? -1;
    const exited = new Promise<ProcessExit>((resolve) => {
      child.on("exit", (code, signal) => resolve({ code, signal }));
      child.on("error", (error) => {
        console.error(`[otomat] spawn failed for run ${job.runId}`, error);
        resolve({ code: null, signal: null });
      });
    });

    return {
      pid,
      pgid: pid,
      exited,
      start: () => releaseWorkerStart(job.agentSessionDir, startToken),
      kill: (signal) => killProcessGroup(pid, signal),
    };
  };
}
