import {
  listConversationEvidence,
  listInboxMarks,
  listIssueExecutionEvidenceByIssue,
  listTerminalConversationEvidence,
  type Db,
} from "@otomat/db";
import {
  compareConversations,
  projectConversations,
  projectFollowedCycle,
  projectTerminalConversations,
  type ConversationSnapshot,
  type OpenCycleExecution,
} from "@otomat/domain";

/** How long a finished thread stays listed: the same day the Inbox keeps a resolved demand. */
const FINISHED_WINDOW_MS = 24 * 60 * 60 * 1000;

export function readConversations(db: Db): ConversationSnapshot {
  const observed = new Date();
  const cycles = new Map<string, OpenCycleExecution>();
  for (const [issueId, rows] of listIssueExecutionEvidenceByIssue(db)) {
    const cycle = projectFollowedCycle(rows);
    if (cycle !== null) cycles.set(issueId, cycle);
  }
  const evidence = listConversationEvidence(db, {
    followed_run_ids: [...cycles.values()].map((cycle) => cycle.run_id),
    since: new Date(observed.getTime() - FINISHED_WINDOW_MS).toISOString(),
  });
  const marks = listInboxMarks(db);
  return {
    entries: [
      ...projectConversations(evidence, marks, cycles),
      ...projectTerminalConversations(listTerminalConversationEvidence(db), marks, cycles),
    ].toSorted(compareConversations),
    observed_at: observed.toISOString(),
  };
}
