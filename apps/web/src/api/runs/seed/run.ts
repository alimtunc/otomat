import type { RunContract } from "@otomat/domain";
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@web/api/query-keys";

export function seedIssueRun(client: QueryClient, run: RunContract): void {
  client.setQueryData<RunContract[]>(queryKeys.runsForIssue(run.issue_id), (runs = []) => [
    ...runs.filter((candidate) => candidate.id !== run.id),
    run,
  ]);
}
