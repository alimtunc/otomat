import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { hasErrorCode } from "#shared/fs-errors";

const FILENAME = "update-check.json";

/** Restarting must not become a way to poll GitHub; the startup check honours this window. */
export const CHECK_COOLDOWN_MS = 4 * 60 * 60_000;

function path(dataDir: string): string {
  return join(dataDir, FILENAME);
}

export function readLastCheck(dataDir: string, log: (message: string) => void): string | null {
  let text: string;
  try {
    text = readFileSync(path(dataDir), "utf8");
  } catch (error) {
    if (hasErrorCode(error) && error.code === "ENOENT") return null;
    log(`Update check record unreadable: ${String(error)}`);
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null || !("checked_at" in parsed)) return null;
    const checkedAt = parsed.checked_at;
    if (typeof checkedAt !== "string" || Number.isNaN(Date.parse(checkedAt))) return null;
    return checkedAt;
  } catch (error) {
    log(`Update check record invalid: ${String(error)}`);
    return null;
  }
}

/** A record that cannot be written costs a cooldown, never a check. */
export function writeLastCheck(
  dataDir: string,
  checkedAt: string,
  log: (message: string) => void,
): void {
  const target = path(dataDir);
  try {
    writeFileSync(`${target}.tmp`, `${JSON.stringify({ checked_at: checkedAt }, null, 2)}\n`);
    renameSync(`${target}.tmp`, target);
  } catch (error) {
    log(`Update check record could not be saved: ${String(error)}`);
  }
}

export function cooldownElapsed(checkedAt: string | null, now: number): boolean {
  if (checkedAt === null) return true;
  const last = Date.parse(checkedAt);
  return Number.isNaN(last) || now - last >= CHECK_COOLDOWN_MS;
}
