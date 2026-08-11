import type { EventEnvelope } from "@otomat/domain";
import type { QueryClient } from "@tanstack/react-query";
import { invalidateWriteback } from "@web/api/linear/writeback";
import { queryKeys } from "@web/api/query-keys";

/** Linear writes carry the issue they landed on, so only that issue's caches are dropped. */
function issueIdOf(event: EventEnvelope): string | null {
  const issueId = event.payload["issue_id"];
  return typeof issueId === "string" && issueId !== "" ? issueId : null;
}

/** The event-driven sync policy: maps a run ledger event to the REST caches it invalidates. */
export function invalidateForEvent(client: QueryClient, runId: string, event: EventEnvelope): void {
  if (event.type === "run.contribution") {
    client.invalidateQueries({ queryKey: queryKeys.runContributions(runId) });
    return;
  }
  if (
    event.type === "run.lifecycle" ||
    event.type === "run.plan_revised" ||
    event.type === "system.reconciled"
  ) {
    client.invalidateQueries({ queryKey: queryKeys.run(runId) });
    client.invalidateQueries({ queryKey: queryKeys.runs });
    client.invalidateQueries({ queryKey: queryKeys.runContributions(runId) });
    client.invalidateQueries({ queryKey: queryKeys.issues });
    return;
  }
  client.invalidateQueries({ queryKey: queryKeys.runCompletionReport(runId) });
  if (event.type === "git.diff_updated") {
    client.invalidateQueries({ queryKey: queryKeys.runDiff(runId) });
    return;
  }
  if (event.type.startsWith("review.")) {
    client.invalidateQueries({ queryKey: queryKeys.runReview(runId) });
    return;
  }
  if (event.type.startsWith("linear.")) {
    const issueId = issueIdOf(event);
    if (issueId === null) return;
    void invalidateWriteback(client, issueId);
    client.invalidateQueries({ queryKey: queryKeys.issues });
    return;
  }
  if (event.type.startsWith("pr.")) {
    client.invalidateQueries({ queryKey: queryKeys.runPullRequest(runId) });
    client.invalidateQueries({ queryKey: queryKeys.issues });
    return;
  }
}
