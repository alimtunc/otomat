import {
  listActivityEvidence,
  listInboxPullRequestEvidence,
  readGitHubViewer,
  type Db,
} from "@otomat/db";
import { projectInbox, type InboxSnapshot } from "@otomat/domain";

/** How long a resolved entry stays visible: long enough to be seen after a night away, not a history. */
const RESOLVED_WINDOW_MS = 24 * 60 * 60 * 1000;
const RESOLVED_LIMIT = 12;

export function readInbox(db: Db): InboxSnapshot {
  const observed = new Date();
  const since = new Date(observed.getTime() - RESOLVED_WINDOW_MS).toISOString();
  const viewer = readGitHubViewer(db);
  return {
    entries: projectInbox(
      {
        runs: listActivityEvidence(db, since),
        pull_requests: listInboxPullRequestEvidence(db),
        viewer: { login: viewer.login, teams: viewer.teams ?? [] },
      },
      { since, limit: RESOLVED_LIMIT },
    ),
    observed_at: observed.toISOString(),
  };
}
