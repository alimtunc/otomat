import type { EventEnvelope } from "@otomat/domain";
import type { QueryClient } from "@tanstack/react-query";
import { invalidateWriteback } from "@web/api/linear/writeback";
import { queryKeys } from "@web/api/query-keys";

function issueIdOf(event: EventEnvelope): string | null {
  const issueId = event.payload["issue_id"];
  return typeof issueId === "string" && issueId !== "" ? issueId : null;
}

export function invalidateForEvent(client: QueryClient, runId: string, event: EventEnvelope): void {
  if (event.type === "run.contribution") {
    client.invalidateQueries({ queryKey: queryKeys.runContributions(runId) });
    return;
  }
  if (event.type.startsWith("runtime.interaction_")) {
    client.invalidateQueries({ queryKey: queryKeys.runInteractions(runId) });
    client.invalidateQueries({ queryKey: queryKeys.run(runId) });
    client.invalidateQueries({ queryKey: queryKeys.activity });
    client.invalidateQueries({ queryKey: queryKeys.inbox });
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
    client.invalidateQueries({ queryKey: queryKeys.reviews });
    client.invalidateQueries({ queryKey: queryKeys.inbox });
    return;
  }
  client.invalidateQueries({ queryKey: queryKeys.runCompletionReport(runId) });
  if (event.type === "runtime.usage") {
    client.invalidateQueries({ queryKey: queryKeys.runUsage(runId) });
    client.invalidateQueries({ queryKey: queryKeys.usage });
    return;
  }
  if (event.type === "git.diff_updated") {
    client.invalidateQueries({ queryKey: queryKeys.reviewDiff({ kind: "run", id: runId }) });
    return;
  }
  if (event.type.startsWith("review.")) {
    client.invalidateQueries({ queryKey: queryKeys.reviewDetail({ kind: "run", id: runId }) });
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
    // A push moves the published head, so the only scope whose diff a `pr.` event changes.
    client.invalidateQueries({
      queryKey: queryKeys.reviewDiff({ kind: "run", id: runId }, { kind: "pull_request" }),
    });
    client.invalidateQueries({ queryKey: queryKeys.issues });
    client.invalidateQueries({ queryKey: queryKeys.reviews });
    client.invalidateQueries({ queryKey: queryKeys.inbox });
    return;
  }
}
