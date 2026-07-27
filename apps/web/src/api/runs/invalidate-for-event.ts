import type { EventEnvelope } from "@otomat/domain";
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@web/api/query-keys";

/** The event-driven sync policy: maps a run ledger event to the REST caches it invalidates. */
export function invalidateForEvent(client: QueryClient, runId: string, event: EventEnvelope): void {
  if (event.type === "run.contribution") {
    client.invalidateQueries({ queryKey: queryKeys.runContributions(runId) });
    return;
  }
  if (event.type === "run.lifecycle" || event.type === "system.reconciled") {
    client.invalidateQueries({ queryKey: queryKeys.run(runId) });
    client.invalidateQueries({ queryKey: queryKeys.runs });
    // Settling a turn resolves the messages it carried without emitting a contribution event of its own.
    client.invalidateQueries({ queryKey: queryKeys.runContributions(runId) });
    // Each issue's execution state is projected from these rows, so its caches go stale with them.
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
  if (event.type.startsWith("pr.")) {
    client.invalidateQueries({ queryKey: queryKeys.runPullRequest(runId) });
    client.invalidateQueries({ queryKey: queryKeys.issues });
    return;
  }
}
