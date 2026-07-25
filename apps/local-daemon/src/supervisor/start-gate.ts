import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import { delay } from "./delay.js";

export const WORKER_START_TOKEN_ENV = "OTOMAT_WORKER_START_TOKEN";

const WORKER_START_TIMEOUT_MS = 30_000;
const WORKER_START_POLL_MS = 10;
const RELEASED_PREFIX = ".worker-start-";
const CONSUMED_PREFIX = ".worker-started-";
const TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireToken(token: string): string {
  if (!TOKEN_PATTERN.test(token)) throw new Error("invalid worker start token");
  return token;
}

function releasedPath(workerDir: string, token: string): string {
  return join(workerDir, `${RELEASED_PREFIX}${requireToken(token)}`);
}

function consumedPath(workerDir: string, token: string): string {
  return join(workerDir, `${CONSUMED_PREFIX}${requireToken(token)}`);
}

function errorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  return typeof error.code === "string" ? error.code : null;
}

function gateEntries(workerDir: string): string[] {
  try {
    return readdirSync(workerDir).filter(
      (entry) => entry.startsWith(RELEASED_PREFIX) || entry.startsWith(CONSUMED_PREFIX),
    );
  } catch (error) {
    if (errorCode(error) === "ENOENT") return [];
    throw error;
  }
}

/** A gate the worker took is the only proof it reached its provider; callers must clear the trace before claiming the next turn. */
export function workerConsumedStartGate(workerDir: string): boolean {
  return gateEntries(workerDir).some((entry) => entry.startsWith(CONSUMED_PREFIX));
}

/** Drops the previous turn's gate trace so the next one speaks only for itself. */
export function clearWorkerStartEvidence(workerDir: string): void {
  for (const entry of gateEntries(workerDir)) {
    rmSync(join(workerDir, entry), { force: true });
  }
}

/** Releases a spawned worker only after its pid and identity have been durably recorded. */
export function releaseWorkerStart(workerDir: string, token: string): void {
  mkdirSync(workerDir, { recursive: true });
  writeFileSync(releasedPath(workerDir, token), "ready", { flag: "wx" });
}

/**
 * Waits for the parent daemon's release file. A pre-release orphan times out without running.
 * Taking the gate renames it rather than deleting it, so a later boot can tell a worker that
 * ran from one that never did.
 */
export async function waitForWorkerStart(
  workerDir: string,
  token: string,
  signal: AbortSignal,
): Promise<boolean> {
  const path = releasedPath(workerDir, token);
  const deadline = Date.now() + WORKER_START_TIMEOUT_MS;
  while (!signal.aborted && Date.now() < deadline) {
    if (existsSync(path)) {
      try {
        renameSync(path, consumedPath(workerDir, token));
        // Durable before the provider is called: an unclean shutdown must not roll the proof back and replay the turn.
        const dir = openSync(workerDir, "r");
        try {
          fsyncSync(dir);
        } finally {
          closeSync(dir);
        }
        return true;
      } catch (error) {
        if (errorCode(error) !== "ENOENT") throw error;
      }
    }
    await delay(WORKER_START_POLL_MS);
  }
  return false;
}
