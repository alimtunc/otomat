import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { expect, it } from "vitest";

import {
  CHECK_COOLDOWN_MS,
  cooldownElapsed,
  readLastCheck,
  writeLastCheck,
} from "#main/update/cooldown";
import { scratchDir } from "#support/scratch-dir";

const CHECKED_AT = "2026-08-22T10:00:00.000Z";

function silent(): (message: string) => void {
  return () => {};
}

it("remembers the last check across restarts", () => {
  const dir = scratchDir("otomat-update-");
  expect(readLastCheck(dir, silent())).toBeNull();
  writeLastCheck(dir, CHECKED_AT, silent());
  expect(readLastCheck(dir, silent())).toBe(CHECKED_AT);
});

it("reports no check rather than a broken one", () => {
  const dir = scratchDir("otomat-update-");
  writeFileSync(join(dir, "update-check.json"), "{ not json");
  const logged: string[] = [];
  expect(readLastCheck(dir, (message) => logged.push(message))).toBeNull();
  expect(logged).toHaveLength(1);
});

it("rejects a timestamp that is not one", () => {
  const dir = scratchDir("otomat-update-");
  writeFileSync(join(dir, "update-check.json"), JSON.stringify({ checked_at: "whenever" }));
  expect(readLastCheck(dir, silent())).toBeNull();
});

it("holds the startup check inside the window and releases it after", () => {
  const now = Date.parse(CHECKED_AT);
  expect(cooldownElapsed(null, now)).toBe(true);
  expect(cooldownElapsed(CHECKED_AT, now + CHECK_COOLDOWN_MS - 1)).toBe(false);
  expect(cooldownElapsed(CHECKED_AT, now + CHECK_COOLDOWN_MS)).toBe(true);
});
