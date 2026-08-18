import { getPullRequestForRun, listAgentSessionsForRun, type Db } from "@otomat/db";
import { contextPullRequestSchema, type ContextPullRequest } from "@otomat/domain";

import { pullRequestContext } from "./workspace.js";

function samePublication(known: ContextPullRequest | null, current: ContextPullRequest): boolean {
  if (known === null) return false;
  return contextPullRequestSchema.keyof().options.every((field) => known[field] === current[field]);
}

/** Measured against the dossier that session was frozen with and never written back, so the correction stands for as long as that dossier contradicts what Otomat recorded. */
export function publicationDelta(
  db: Db,
  runId: string,
  agentSessionId: string,
): ContextPullRequest | null {
  const row = getPullRequestForRun(db, runId);
  const current = row === undefined ? null : pullRequestContext(row);
  if (current === null) return null;
  const session = listAgentSessionsForRun(db, runId).find(
    (candidate) => candidate.id === agentSessionId,
  );
  return samePublication(session?.context_json?.pull_request ?? null, current) ? null : current;
}
