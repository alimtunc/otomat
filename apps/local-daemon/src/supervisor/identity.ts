import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

export const WORKER_IDENTITY_FILE = "worker.json";

const workerIdentitySchema = z.object({
  pid: z.number().int(),
  pgid: z.number().int(),
  start_time: z.string(),
});
type WorkerIdentity = z.infer<typeof workerIdentitySchema>;

/**
 * The OS start time of `pid` (`ps -o lstart`, an absolute wall-clock stamp stable for the life of the
 * process). Paired with the pid it forms an identity the kernel does not recycle: a reused pid has a
 * different start time. Returns null when the pid is gone or `ps` yields nothing.
 */
export function readProcessStartTime(pid: number): string | null {
  if (pid <= 1) return null;
  const result = spawnSync("ps", ["-o", "lstart=", "-p", String(pid)], { encoding: "utf8" });
  if (result.status !== 0) return null;
  const value = result.stdout.trim();
  return value === "" ? null : value;
}

function identityPath(runDir: string): string {
  return join(runDir, WORKER_IDENTITY_FILE);
}

/**
 * Records the live worker's identity (pid + pgid + OS start time) in the run dir so a later boot can
 * prove the process group is still ours before signalling it. No-op if the pid can't be stamped.
 */
export function writeWorkerIdentity(runDir: string, pid: number, pgid: number): void {
  const start_time = readProcessStartTime(pid);
  if (start_time === null) return;
  mkdirSync(runDir, { recursive: true });
  writeFileSync(
    identityPath(runDir),
    JSON.stringify({ pid, pgid, start_time } satisfies WorkerIdentity),
  );
}

export function readWorkerIdentity(runDir: string): WorkerIdentity | null {
  const path = identityPath(runDir);
  if (!existsSync(path)) return null;
  try {
    return workerIdentitySchema.parse(JSON.parse(readFileSync(path, "utf8")));
  } catch {
    return null;
  }
}

/**
 * True only when the live `pid` is provably still the worker we spawned: a recorded identity exists,
 * its pid matches, and the pid's current OS start time equals the recorded one. A missing identity or
 * any mismatch (e.g. the OS reused the pid over a long downtime) returns false — the caller must never
 * signal the group then.
 */
export function isReapableWorker(runDir: string, pid: number): boolean {
  const identity = readWorkerIdentity(runDir);
  if (identity === null || identity.pid !== pid) return false;
  const current = readProcessStartTime(pid);
  return current !== null && current === identity.start_time;
}
