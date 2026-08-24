import type { RuntimeInteractionAnswer } from "@otomat/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";
import { seedInteraction } from "@web/api/runs/seed/interaction";

/** The card shows the refusal beside the controls, so no toast doubles it. */
export function useAnswerRunInteraction(runId: string, interactionId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (answer: RuntimeInteractionAnswer) =>
      daemon.answerRunInteraction(runId, interactionId, { answer }),
    onSuccess: (interaction) => {
      seedInteraction(client, interaction);
      client.invalidateQueries({ queryKey: queryKeys.runInteractions(runId) });
      client.invalidateQueries({ queryKey: queryKeys.run(runId) });
      client.invalidateQueries({ queryKey: queryKeys.activity });
      client.invalidateQueries({ queryKey: queryKeys.inbox });
    },
  });
}
