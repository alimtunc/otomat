import type { RunInteractionContract, RunInteractionsResponse } from "@otomat/domain";
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@web/api/query-keys";

export function seedInteraction(client: QueryClient, interaction: RunInteractionContract): void {
  client.setQueryData<RunInteractionsResponse>(
    queryKeys.runInteractions(interaction.run_id),
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
