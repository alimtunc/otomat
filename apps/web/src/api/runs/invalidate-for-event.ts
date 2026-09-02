import type { EventEnvelope } from "@otomat/domain";
import type { QueryClient } from "@tanstack/react-query";
import { invalidateWriteback } from "@web/api/linear/writeback";
import type { HostQueryKeys } from "@web/api/query-keys";

function issueIdOf(event: EventEnvelope): string | null {
  const issueId = event.payload["issue_id"];
  return typeof issueId === "string" && issueId !== "" ? issueId : null;
}

export function invalidateForEvent(
  client: QueryClient,
  keys: HostQueryKeys,
  runId: string,
  event: EventEnvelope,
): void {
  if (event.type === "run.contribution") {
    client.invalidateQueries({ queryKey: keys.runContributions(runId) });
    return;
  }
  if (event.type.startsWith("runtime.interaction_")) {
    client.invalidateQueries({ queryKey: keys.runInteractions(runId) });
    client.invalidateQueries({ queryKey: keys.run(runId) });
    client.invalidateQueries({ queryKey: keys.activity });
    client.invalidateQueries({ queryKey: keys.inbox });
    return;
  }
  if (
    event.type === "run.lifecycle" ||
    event.type === "run.plan_revised" ||
    event.type === "system.reconciled"
  ) {
    client.invalidateQueries({ queryKey: keys.run(runId) });
    client.invalidateQueries({ queryKey: keys.runs });
    client.invalidateQueries({ queryKey: keys.runContributions(runId) });
    client.invalidateQueries({ queryKey: keys.issues });
    client.invalidateQueries({ queryKey: keys.reviews });
    client.invalidateQueries({ queryKey: keys.inbox });
    return;
  }
  client.invalidateQueries({ queryKey: keys.runCompletionReport(runId) });
  if (event.type === "runtime.usage") {
    client.invalidateQueries({ queryKey: keys.runUsage(runId) });
    client.invalidateQueries({ queryKey: keys.usage });
    return;
  }
  if (event.type === "git.diff_updated") {
    client.invalidateQueries({ queryKey: keys.reviewDiff({ kind: "run", id: runId }) });
    return;
  }
  if (event.type.startsWith("review.")) {
    client.invalidateQueries({ queryKey: keys.reviewDetail({ kind: "run", id: runId }) });
    return;
  }
  if (event.type.startsWith("linear.")) {
    const issueId = issueIdOf(event);
    if (issueId === null) return;
    void invalidateWriteback(client, keys, issueId);
    client.invalidateQueries({ queryKey: keys.issues });
    return;
  }
  if (event.type.startsWith("pr.")) {
    client.invalidateQueries({ queryKey: keys.runPullRequest(runId) });
    // A push moves the published head, so the only scope whose diff a `pr.` event changes.
    client.invalidateQueries({
      queryKey: keys.reviewDiff({ kind: "run", id: runId }, { kind: "pull_request" }),
    });
    client.invalidateQueries({ queryKey: keys.issues });
    client.invalidateQueries({ queryKey: keys.reviews });
    client.invalidateQueries({ queryKey: keys.inbox });
    return;
  }
}
