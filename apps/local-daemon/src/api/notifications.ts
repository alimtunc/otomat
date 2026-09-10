import {
  getPullRequest,
  listActivityEvidence,
  listAgentSessionsForRun,
  listCompeteGroupsForRun,
  listPendingRunInteractions,
  type Db,
} from "@otomat/db";
import {
  projectCompletedNotifications,
  projectInboxNotifications,
  type InboxEntry,
  type InboxNotificationEvidence,
  type NotificationSnapshot,
} from "@otomat/domain";

import { readRunEventsOfTypes } from "#events";

import { readInbox } from "./inbox.js";

function runRevision(db: Db, runId: string, kind: InboxEntry["kind"]): string {
  const boundary = readRunEventsOfTypes(db, runId, ["run.lifecycle", "run.plan_revised"]).findLast(
    (event) =>
      event.type === "run.plan_revised" ||
      event.payload.phase === "final" ||
      event.payload.phase === "reopened",
  );
  if (kind !== "run_awaiting_answer") return boundary?.id ?? runId;
  const session = listAgentSessionsForRun(db, runId)
    .toSorted((a, b) => (a.started_at ?? "").localeCompare(b.started_at ?? ""))
    .at(-1);
  return JSON.stringify([boundary?.id ?? runId, session?.id ?? null, session?.started_at ?? null]);
}

function notificationEvidence(db: Db, entry: InboxEntry): InboxNotificationEvidence {
  if (entry.target.kind === "pull_request") {
    const pullRequest = getPullRequest(db, entry.target.pull_request_id);
    if (pullRequest === undefined) throw new Error("Notification pull request is missing.");
    return {
      entry,
      revision: pullRequest.provider_updated_at ?? "legacy",
      requests: [],
      selections: [],
    };
  }
  const runId = entry.target.run_id;
  return {
    entry,
    revision: runRevision(db, runId, entry.kind),
    requests: entry.kind === "permission_request" ? listPendingRunInteractions(db, runId) : [],
    selections:
      entry.kind === "run_awaiting_selection"
        ? listCompeteGroupsForRun(db, runId)
            .filter((group) => group.status === "awaiting_selection")
            .map((group) => group.id)
        : [],
  };
}

export function readNotifications(db: Db): NotificationSnapshot {
  return db.transaction(() => ({
    notifications: [
      ...readInbox(db)
        .entries.filter((entry) => entry.state === "open")
        .flatMap((entry) => projectInboxNotifications(notificationEvidence(db, entry))),
      ...projectCompletedNotifications(listActivityEvidence(db, new Date(0).toISOString())),
    ],
  }));
}
