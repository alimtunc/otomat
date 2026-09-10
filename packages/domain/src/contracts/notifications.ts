import { z } from "zod";

import { EXECUTION_HOST_IDS } from "./execution-host.js";
import { inboxTargetSchema } from "./inbox.js";

export const NOTIFICATION_CATEGORIES = [
  "permission",
  "question",
  "review",
  "completed",
  "blocked",
] as const;
const notificationCategorySchema = z.enum(NOTIFICATION_CATEGORIES);
export type NotificationCategory = z.infer<typeof notificationCategorySchema>;

const notificationIntentSchema = z.object({
  id: z.string().min(1),
  category: notificationCategorySchema,
  project_id: z.string().min(1),
  target: inboxTargetSchema,
  step_run_id: z.string().nullable(),
  interaction_id: z.string().nullable(),
});
export type NotificationIntent = z.infer<typeof notificationIntentSchema>;
export const notificationSnapshotSchema = z.object({
  notifications: z.array(notificationIntentSchema),
});
export type NotificationSnapshot = z.infer<typeof notificationSnapshotSchema>;

export const notificationPreferencesSchema = z
  .object({
    categories: z
      .object({
        permission: z.boolean(),
        question: z.boolean(),
        review: z.boolean(),
        completed: z.boolean(),
        blocked: z.boolean(),
      })
      .strict(),
    detail: z.enum(["generic", "category"]),
  })
  .strict();
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  categories: { permission: true, question: true, review: true, completed: true, blocked: true },
  detail: "generic",
};

export const desktopNotificationSchema = notificationIntentSchema.extend({
  host_id: z.enum(EXECUTION_HOST_IDS),
  host_alias: z.string().nullable(),
});
export type DesktopNotification = z.infer<typeof desktopNotificationSchema>;

export interface DesktopNotificationSnapshot {
  preferences: NotificationPreferences;
  delivery: "system_managed" | "unavailable" | "failed";
  error: string | null;
}

export interface DesktopNotificationsBridge {
  snapshot(): Promise<DesktopNotificationSnapshot>;
  save(preferences: NotificationPreferences): Promise<DesktopNotificationSnapshot>;
  openSettings(): Promise<void>;
  pending(): Promise<DesktopNotification | null>;
  acknowledge(id: string): Promise<void>;
  onNotice(listener: (notification: DesktopNotification) => void): () => void;
  onOpen(listener: (notification: DesktopNotification) => void): () => void;
}
