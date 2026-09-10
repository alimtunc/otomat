import type { RunInteractionContract } from "../contracts/entities/runs.js";
import type { InboxEntry, InboxEntryKind } from "../contracts/inbox.js";
import type {
  DesktopNotification,
  NotificationCategory,
  NotificationPreferences,
  NotificationIntent,
} from "../contracts/notifications.js";
import type { ActivityEvidence } from "./activity.js";

const INBOX_NOTIFICATION_CATEGORY = {
  permission_request: "permission",
  run_awaiting_selection: "permission",
  run_awaiting_answer: "question",
  run_review_ready: "review",
  pull_request_review_requested: "review",
  provider_quota: "blocked",
  run_failed: "blocked",
  publication_stopped: "blocked",
  pull_request_blocked: "blocked",
} satisfies Record<InboxEntryKind, NotificationCategory>;

export interface InboxNotificationEvidence {
  entry: InboxEntry;
  revision: string;
  requests: Pick<RunInteractionContract, "id" | "kind" | "step_run_id">[];
  selections: string[];
}

export function projectInboxNotifications({
  entry,
  revision,
  requests,
  selections,
}: InboxNotificationEvidence): NotificationIntent[] {
  const base: NotificationIntent = {
    id: `${entry.id}:${entry.kind}:${revision}`,
    category: INBOX_NOTIFICATION_CATEGORY[entry.kind],
    project_id: entry.project.id,
    target: entry.target,
    step_run_id: null,
    interaction_id: null,
  };
  if (entry.kind === "permission_request") {
    return requests.map((request) => ({
      ...base,
      id: `interaction:${request.id}`,
      category:
        request.kind === "permission" || request.kind === "choice" ? "permission" : "question",
      step_run_id: request.step_run_id,
      interaction_id: request.id,
    }));
  }
  if (entry.kind === "run_awaiting_selection") {
    return selections.map((id) => ({ ...base, id: `selection:${id}` }));
  }
  return [base];
}

export function projectCompletedNotifications(rows: ActivityEvidence[]): NotificationIntent[] {
  return rows.flatMap((row) =>
    row.run_status === "completed"
      ? [
          {
            id: `completed:${row.run_id}`,
            category: "completed",
            project_id: row.project_id,
            target: { kind: "run", run_id: row.run_id },
            step_run_id: null,
            interaction_id: null,
          },
        ]
      : [],
  );
}

export const NOTIFICATION_HEADLINES = {
  permission: "Permission or choice requested",
  question: "A question needs your answer",
  review: "Work is ready to review",
  completed: "Run completed",
  blocked: "Work failed or is blocked",
} satisfies Record<NotificationCategory, string>;

export function notificationBody(
  category: NotificationCategory,
  detail: NotificationPreferences["detail"],
): string {
  return detail === "generic" ? "Open Otomat to view an update." : NOTIFICATION_HEADLINES[category];
}

export function notificationIdentity(notification: DesktopNotification): string {
  return JSON.stringify([notification.host_id, notification.host_alias, notification.id]);
}
