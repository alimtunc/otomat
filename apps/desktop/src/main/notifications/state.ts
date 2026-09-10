import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  notificationPreferencesSchema,
  type NotificationPreferences,
} from "@otomat/domain";

import { hasErrorCode } from "#shared/fs-errors";

export interface NotificationState {
  preferences: NotificationPreferences;
  seen: string[];
}

export function readNotificationState(dataDir: string): NotificationState {
  try {
    const value: unknown = JSON.parse(readFileSync(join(dataDir, "notifications.json"), "utf8"));
    if (
      typeof value !== "object" ||
      value === null ||
      !("preferences" in value) ||
      !("seen" in value) ||
      !Array.isArray(value.seen) ||
      !value.seen.every((id): id is string => typeof id === "string")
    ) {
      throw new Error("Invalid notification state.");
    }
    return {
      preferences: notificationPreferencesSchema.parse(value.preferences),
      seen: value.seen,
    };
  } catch (error) {
    if (hasErrorCode(error) && error.code === "ENOENT") {
      return { preferences: DEFAULT_NOTIFICATION_PREFERENCES, seen: [] };
    }
    throw error;
  }
}

export function writeNotificationState(dataDir: string, state: NotificationState): void {
  const path = join(dataDir, "notifications.json");
  writeFileSync(`${path}.tmp`, JSON.stringify(state), { mode: 0o600 });
  renameSync(`${path}.tmp`, path);
}
