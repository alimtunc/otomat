import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

import { delay } from "./delay.js";

export const WORKER_IDENTITY_FILE = "worker.json";

const workerIdentitySchema = z.object({
  pid: z.number().int(),
  pgid: z.number().int(),
  start_time: z.string(),
});
export type WorkerIdentity = z.infer<typeof workerIdentitySchema>;

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

function identityPath(workerDir: string): string {
  return join(workerDir, WORKER_IDENTITY_FILE);
}

/**
 * Records the live worker's identity (pid + pgid + OS start time) in its dir so a later boot can
 * prove the process group is still ours before signalling it. Returns false if the pid can't be stamped.
 */
export function writeWorkerIdentity(workerDir: string, pid: number, pgid: number): boolean {
  const start_time = readProcessStartTime(pid);
  if (start_time === null) return false;
  mkdirSync(workerDir, { recursive: true });
  writeFileSync(
    identityPath(workerDir),
    JSON.stringify({ pid, pgid, start_time } satisfies WorkerIdentity),
  );
  return true;
}

/** Gives a freshly spawned pid a bounded window to become visible to `ps` before startup fails. */
export async function waitForWorkerIdentity(
  workerDir: string,
  pid: number,
  pgid: number,
): Promise<boolean> {
  const deadline = Date.now() + 2_000;
  do {
    if (writeWorkerIdentity(workerDir, pid, pgid)) return true;
    await delay(10);
  } while (Date.now() < deadline);
  return false;
}

/** Reads the recorded worker identity, or null when the file is absent or unparseable. */
export function readWorkerIdentity(workerDir: string): WorkerIdentity | null {
  const path = identityPath(workerDir);
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
export function isReapableWorker(workerDir: string, pid: number): boolean {
  const identity = readWorkerIdentity(workerDir);
  if (identity === null || identity.pid !== pid) return false;
  const current = readProcessStartTime(pid);
  return current !== null && current === identity.start_time;
}
