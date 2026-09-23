import { changesReportedCommands, type EventEnvelope, type EventType } from "@otomat/domain";
import type { QueryClient } from "@tanstack/react-query";
import { invalidateWriteback } from "@web/api/linear/writeback";
import type { HostQueryKeys } from "@web/api/query-keys";

// Streamed output reaches the timeline through the stream itself; refetching on it storms the daemon.
const STREAMED_EVENTS: ReadonlySet<EventType> = new Set([
  "runtime.log",
  "runtime.message",
  "runtime.permission_request",
  "runtime.permission_response",
  "runtime.tool_call",
]);

const RUN_DETAIL_EVENTS: ReadonlySet<EventType> = new Set([
  "step.lifecycle",
  "session.lifecycle",
  "session.model_override",
  "compete.lifecycle",
  "run.delivery_blocked",
  "run.guard_override",
  "run.supervision_decision",
  "runtime.provider_session",
  "runtime.provider_limit",
]);

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
    client.invalidateQueries({ queryKey: keys.run(runId), exact: true });
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
    client.invalidateQueries({ queryKey: keys.issues });
    client.invalidateQueries({ queryKey: keys.reviews });
    client.invalidateQueries({ queryKey: keys.inbox });
    return;
  }
  if (STREAMED_EVENTS.has(event.type) && !changesReportedCommands(event)) return;
  client.invalidateQueries({ queryKey: keys.runCompletionReport(runId) });
  if (RUN_DETAIL_EVENTS.has(event.type)) {
    client.invalidateQueries({ queryKey: keys.run(runId), exact: true });
    return;
  }
  if (event.type === "runtime.usage") {
    client.invalidateQueries({ queryKey: keys.runUsage(runId) });
    client.invalidateQueries({ queryKey: keys.usage });
    return;
  }
  if (event.type === "git.diff_updated") {
    client.invalidateQueries({ queryKey: keys.reviewDiffs({ kind: "run", id: runId }) });
    client.invalidateQueries({ queryKey: keys.runFiles(runId) });
    client.invalidateQueries({ queryKey: keys.sourceControl({ kind: "run", id: runId }) });
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
    client.invalidateQueries({ queryKey: keys.reviewDiffs({ kind: "run", id: runId }) });
    client.invalidateQueries({ queryKey: keys.issues });
    client.invalidateQueries({ queryKey: keys.reviews });
    client.invalidateQueries({ queryKey: keys.inbox });
  }
}
