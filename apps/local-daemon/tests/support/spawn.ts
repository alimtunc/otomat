import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  killProcessGroup,
  WORKER_JOB_ENV,
  WORKER_START_TOKEN_ENV,
  type ProcessExit,
  type SessionProcess,
  type SpawnSession,
  type SupervisedJob,
} from "#supervisor";

const FAKE_WORKER = join(dirname(fileURLToPath(import.meta.url)), "fake-worker.mjs");

function toHandle(child: ReturnType<typeof spawn>, start: SessionProcess["start"]): SessionProcess {
  const pid = child.pid ?? -1;
  const exited = new Promise<ProcessExit>((resolve) => {
    child.on("exit", (code, signal) => resolve({ code, signal }));
    child.on("error", () => resolve({ code: null, signal: null }));
  });
  return {
    pid,
    pgid: pid,
    exited,
    start,
    kill: (signal) => killProcessGroup(pid, signal),
  };
}

export type WorkerBehavior = "complete" | "fail" | "crash" | "linger";

/** Launches the real fake-worker per job and records spawned jobs; a behavior array maps one entry per call, last entry repeats. */
export function workerSpawn(
  behavior: WorkerBehavior | WorkerBehavior[],
): SpawnSession & { calls: number; jobs: SupervisedJob[] } {
  const behaviors = Array.isArray(behavior) ? behavior : [behavior];
  const spawnFn = (job: SupervisedJob): SessionProcess => {
    const turnBehavior = behaviors[Math.min(spawnFn.calls, behaviors.length - 1)];
    const startToken = randomUUID();
    spawnFn.calls += 1;
    spawnFn.jobs.push(job);
    const child = spawn(process.execPath, [FAKE_WORKER], {
      env: {
        ...process.env,
        [WORKER_JOB_ENV]: JSON.stringify(job),
        [WORKER_START_TOKEN_ENV]: startToken,
        FAKE_WORKER_BEHAVIOR: turnBehavior,
      },
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    return toHandle(child, () => {
      mkdirSync(job.runDir, { recursive: true });
      writeFileSync(join(job.runDir, `.worker-start-${startToken}`), "ready", { flag: "wx" });
    });
  };
  spawnFn.calls = 0;
  spawnFn.jobs = [] as SupervisedJob[];
  return spawnFn;
}

/** Spawns a detached, long-lived process and returns its pid/pgid — an "orphan" for reconciliation. */
export function spawnOrphan(): { pid: number; pgid: number; stop(): void } {
  const child = spawn(process.execPath, ["-e", "setInterval(()=>{}, 1000)"], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  const pid = child.pid ?? -1;
  return {
    pid,
    pgid: pid,
    stop: () => killProcessGroup(pid, "SIGKILL"),
  };
}

/** Spawns a process, waits for it to exit, and returns its now-dead pid. */
export async function deadPid(): Promise<number> {
  const child = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
  const pid = child.pid ?? -1;
  await new Promise<void>((resolve) => child.on("exit", () => resolve()));
  return pid;
}
