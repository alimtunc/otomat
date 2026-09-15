import type { RunInteractionContract } from "../contracts/entities/runs.js";
import {
  INBOX_KIND_COPY,
  type InboxEntry,
  type InboxEntryKind,
  type InboxKindCopy,
} from "../contracts/inbox.js";
import type {
  DesktopNotification,
  NotificationCategory,
  NotificationIntent,
} from "../contracts/notifications.js";
import type { RunState } from "../state-machines/run.js";
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

const QUESTION_COPY: InboxKindCopy = { label: "Question asked", action: "Answer the question" };
const COMPLETED_COPY: InboxKindCopy = {
  label: "Run completed",
  action: "Completion report ready, nothing to do",
};

function notificationCopy(
  subject: InboxEntry["subject"],
  copy: InboxKindCopy,
  detail: string | null,
): Pick<NotificationIntent, "title" | "body"> {
  const name =
    subject.title.trim() === "" ? (subject.identifier ?? "Untitled issue") : subject.title;
  const subjectLine = detail === null ? name : `${name} · ${detail}`;
  return {
    title: subject.identifier === null ? copy.label : `${subject.identifier} · ${copy.label}`,
    body: `${subjectLine}\n${copy.action}`,
  };
}

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
  // A publication detail quotes git output, which can name remotes and paths.
  const detail = entry.kind === "publication_stopped" ? null : entry.detail;
  const base: NotificationIntent = {
    id: `${entry.id}:${entry.kind}:${revision}`,
    category: INBOX_NOTIFICATION_CATEGORY[entry.kind],
    project_id: entry.project.id,
    target: entry.target,
    step_run_id: null,
    interaction_id: null,
    ...notificationCopy(entry.subject, INBOX_KIND_COPY[entry.kind], detail),
  };
  if (entry.kind === "permission_request") {
    return requests.map((request) => {
      const category =
        request.kind === "permission" || request.kind === "choice" ? "permission" : "question";
      const copy = category === "question" ? QUESTION_COPY : INBOX_KIND_COPY.permission_request;
      return {
        ...base,
        id: `interaction:${request.id}`,
        category,
        step_run_id: request.step_run_id,
        interaction_id: request.id,
        ...notificationCopy(entry.subject, copy, detail),
      };
    });
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
            ...notificationCopy(
              { identifier: row.issue_identifier, title: row.issue_title },
              COMPLETED_COPY,
              null,
            ),
          },
        ]
      : [],
  );
}

export const NOTIFICATION_HEADLINES = {
  permission: "Action required",
  question: "Action required",
  review: "Ready for review",
  completed: "Run completed",
  blocked: "Run failed or is blocked",
} satisfies Record<NotificationCategory, string>;

export const RUN_NOTIFICATION_CATEGORY = {
  queued: null,
  preparing: null,
  running: null,
  waiting_for_provider: null,
  awaiting_permission: "permission",
  awaiting_selection: "permission",
  awaiting_human: "question",
  review_ready: "review",
  completed: "completed",
  failed: "blocked",
  canceled: null,
} satisfies Record<RunState, NotificationCategory | null>;

export function notificationIdentity(notification: DesktopNotification): string {
  return JSON.stringify([notification.host_id, notification.host_alias, notification.id]);
}
