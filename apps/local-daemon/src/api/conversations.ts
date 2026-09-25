import {
  listConversationEvidence,
  listTerminalRecords,
  getProject,
  getIssue,
  listInboxMarks,
  listIssueExecutionEvidenceByIssue,
  type Db,
} from "@otomat/db";
import {
  projectConversations,
  projectFollowedCycle,
  type ConversationSnapshot,
  type OpenCycleExecution,
  type TerminalConversationEntry,
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
  const marksById = new Map(marks.map((mark) => [mark.entry_id, mark]));
  const terminals: TerminalConversationEntry[] = listTerminalRecords(db).flatMap(
    ({ session, updated_at }) => {
      const project = getProject(db, session.project_id);
      if (!project) return [];
      const issue = session.issue_id === null ? null : getIssue(db, session.issue_id);
      const id = `terminal:${session.id}`;
      const saved = marksById.get(id);
      const mark = saved && saved.evidence_updated_at >= updated_at ? saved : undefined;
      return [
        {
          id,
          project: { id: project.id, name: project.name },
          issue: issue
            ? {
                id: issue.id,
                identifier: issue.source_identifier,
                title: issue.title,
                cycle: cycles.get(issue.id)?.state ?? null,
              }
            : null,
          terminal: session,
          updated_at,
          read: mark?.read ?? false,
          archived: mark?.archived ?? false,
        },
      ];
    },
  );
  return {
    entries: [...projectConversations(evidence, marks, cycles), ...terminals].toSorted(
      (a, b) => b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id),
    ),
    observed_at: observed.toISOString(),
  };
}
