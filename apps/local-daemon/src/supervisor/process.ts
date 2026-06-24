import { spawn } from "node:child_process";

import {
  WORKER_JOB_ENV,
  type ProcessExit,
  type SessionProcess,
  type SupervisedJob,
} from "./types.js";

/**
 * Is `pid` a live process? `kill(pid, 0)` sends no signal; it only probes. `ESRCH`
 * means gone, `EPERM` means alive but owned by another user (still "alive" for our
 * purposes). Any other error is treated as not-alive to stay conservative.
 */
export function isProcessAlive(pid: number): boolean {
  // Reject non-positive sentinels: `kill(0/-1)` mean "my group"/"every process",
  // and pid 1 is init — none are a supervised worker we may probe or signal.
  if (pid <= 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * Signal a whole process group (`kill(-pgid)`). The detached worker is its own
 * group leader, so this also reaps any grandchildren it spawned. A missing group
 * (already-dead, or a pid the OS reused that is not this group's leader) yields
 * `ESRCH` and is ignored, which keeps the blast radius off unrelated processes.
 */
export function killProcessGroup(pgid: number, signal: NodeJS.Signals): void {
  // Guard against `-pgid` resolving to PID 1 (pgid 1), the whole system (pgid 0 ->
  // kill(-0)=kill(0)), or the -1 sentinel from a failed spawn (kill(1)).
  if (pgid <= 1) return;
  try {
    process.kill(-pgid, signal);
  } catch {
    // ESRCH: group already gone. Nothing to reap.
  }
}

/**
 * Re-execs the daemon's own entrypoint in worker mode (gated by {@link WORKER_JOB_ENV}),
 * detached into a fresh process group so the child outlives a daemon crash and can be
 * group-signalled. `mainScript` is the entry to re-run (`process.argv[1]`); `execArgv`
 * carries dev loader flags (e.g. tsx) so it works from `src` and from bundled `dist`.
 */
export function createReexecSpawn(mainScript: string): (job: SupervisedJob) => SessionProcess {
  return (job) => {
    const child = spawn(process.execPath, [...process.execArgv, mainScript], {
      env: { ...process.env, [WORKER_JOB_ENV]: JSON.stringify(job) },
      detached: true,
      stdio: "ignore",
    });
    child.unref();

    const pid = child.pid ?? -1;
    const exited = new Promise<ProcessExit>((resolve) => {
      child.on("exit", (code, signal) => resolve({ code, signal }));
      child.on("error", () => resolve({ code: null, signal: null }));
    });

    return {
      pid,
      pgid: pid,
      exited,
      kill: (signal) => killProcessGroup(pid, signal),
    };
  };
}
