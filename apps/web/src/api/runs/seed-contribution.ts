import type { RunContributionContract, RunContributionsResponse } from "@otomat/domain";
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@web/api/query-keys";

export function seedContribution(client: QueryClient, contribution: RunContributionContract): void {
  client.setQueryData<RunContributionsResponse>(
    queryKeys.runContributions(contribution.run_id),
    (current) => {
      if (current === undefined) return current;
      const known = current.contributions.some((candidate) => candidate.id === contribution.id);
      return {
        ...current,
        contributions: known
          ? current.contributions.map((candidate) =>
              candidate.id === contribution.id ? contribution : candidate,
            )
          : [...current.contributions, contribution].toSorted(
              (left, right) => left.seq - right.seq,
            ),
      };
    },
  );
}
