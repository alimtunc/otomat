import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const WORKER_START_TOKEN_ENV = "OTOMAT_WORKER_START_TOKEN";

const WORKER_START_TIMEOUT_MS = 30_000;
const WORKER_START_POLL_MS = 10;
const TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function startGatePath(runDir: string, token: string): string {
  if (!TOKEN_PATTERN.test(token)) throw new Error("invalid worker start token");
  return join(runDir, `.worker-start-${token}`);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  return typeof error.code === "string" ? error.code : null;
}

/** Releases a spawned worker only after its pid and identity have been durably recorded. */
export function releaseWorkerStart(runDir: string, token: string): void {
  mkdirSync(runDir, { recursive: true });
  writeFileSync(startGatePath(runDir, token), "ready", { flag: "wx" });
}

/** Waits for the parent daemon's release file. A pre-release orphan times out without running. */
export async function waitForWorkerStart(
  runDir: string,
  token: string,
  signal: AbortSignal,
): Promise<boolean> {
  const path = startGatePath(runDir, token);
  const deadline = Date.now() + WORKER_START_TIMEOUT_MS;
  while (!signal.aborted && Date.now() < deadline) {
    if (existsSync(path)) {
      try {
        unlinkSync(path);
        return true;
      } catch (error) {
        if (errorCode(error) !== "ENOENT") throw error;
      }
    }
    await delay(WORKER_START_POLL_MS);
  }
  return false;
}
