import type { RunContract } from "@otomat/domain";
import type { QueryClient } from "@tanstack/react-query";
import type { HostQueryKeys } from "@web/api/query-keys";

export function seedIssueRun(client: QueryClient, keys: HostQueryKeys, run: RunContract): void {
  client.setQueryData<RunContract[]>(keys.runsForIssue(run.issue_id), (runs = []) => [
    ...runs.filter((candidate) => candidate.id !== run.id),
    run,
  ]);
}
