import type { RuntimeInteractionAnswer } from "@otomat/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { seedInteraction } from "@web/api/runs/seed/interaction";
import { useQueryKeys } from "@web/api/use-query-keys";

/** The card shows the refusal beside the controls, so no toast doubles it. */
export function useAnswerRunInteraction(runId: string, interactionId: string) {
  const keys = useQueryKeys();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (answer: RuntimeInteractionAnswer) =>
      daemon.answerRunInteraction(runId, interactionId, { answer }),
    onSuccess: (interaction) => {
      seedInteraction(client, keys, interaction);
      client.invalidateQueries({ queryKey: keys.runInteractions(runId) });
      client.invalidateQueries({ queryKey: keys.run(runId) });
      client.invalidateQueries({ queryKey: keys.activity });
      client.invalidateQueries({ queryKey: keys.inbox });
    },
  });
}
