import type { RunInteractionContract, RunInteractionsResponse } from "@otomat/domain";
import type { QueryClient } from "@tanstack/react-query";
import type { HostQueryKeys } from "@web/api/query-keys";

export function seedInteraction(
  client: QueryClient,
  keys: HostQueryKeys,
  interaction: RunInteractionContract,
): void {
  client.setQueryData<RunInteractionsResponse>(
    keys.runInteractions(interaction.run_id),
    (current) => {
      if (current === undefined) return current;
      const known = current.interactions.some((candidate) => candidate.id === interaction.id);
      return {
        ...current,
        interactions: known
          ? current.interactions.map((candidate) =>
              candidate.id === interaction.id ? interaction : candidate,
            )
          : [...current.interactions, interaction],
      };
    },
  );
}
