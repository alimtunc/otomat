import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { DEFAULT_NOTIFICATION_PREFERENCES } from "@otomat/domain";
import { expect, it } from "vitest";

import { readNotificationState, writeNotificationState } from "#main/notifications/state";
import { scratchDir } from "#support/scratch-dir";

it("persists preferences and replay IDs and refuses corrupt state", () => {
  const dir = scratchDir("otomat-notifications-");
  expect(readNotificationState(dir)).toEqual({
    preferences: DEFAULT_NOTIFICATION_PREFERENCES,
    seen: [],
  });
  const saved = {
    preferences: { ...DEFAULT_NOTIFICATION_PREFERENCES, detail: "category" as const },
    seen: ["event"],
  };
  writeNotificationState(dir, saved);
  expect(readNotificationState(dir)).toEqual(saved);
  expect(JSON.parse(readFileSync(join(dir, "notifications.json"), "utf8"))).toEqual(saved);
  writeFileSync(join(dir, "notifications.json"), '{"seen":[42]}');
  expect(() => readNotificationState(dir)).toThrow("Invalid notification state");
});
