import type { SaveLinearDraftRequest } from "@otomat/domain";
import { useMutation } from "@tanstack/react-query";
import { daemon } from "@web/api/client";

import { invalidateWriteback } from "./cache";
import { useOptimisticWriteback } from "./optimistic";

export function useSaveLinearDraft(issueId: string) {
  const optimistic = useOptimisticWriteback(
    issueId,
    (current, request: SaveLinearDraftRequest) => ({
      writes: current?.writes ?? [],
      draft: {
        id: current?.draft?.id ?? "optimistic",
        issue_id: issueId,
        base_updated_at: request.base_updated_at,
        title: request.title,
        description: request.description,
        priority: request.priority,
        assignee_id: request.assignee_id,
        label_ids: request.label_ids,
        updated_at: current?.draft?.updated_at ?? new Date().toISOString(),
      },
    }),
  );
  return useMutation({
    mutationFn: (request: SaveLinearDraftRequest) => daemon.saveLinearDraft(issueId, request),
    onMutate: optimistic.onMutate,
    onError: optimistic.onError,
    onSettled: () => invalidateWriteback(optimistic.client, issueId),
  });
}

export function useDiscardLinearDraft(issueId: string) {
  const optimistic = useOptimisticWriteback<void>(issueId, (current) => ({
    writes: current?.writes ?? [],
    draft: null,
  }));
  return useMutation({
    mutationFn: () => daemon.discardLinearDraft(issueId),
    onMutate: optimistic.onMutate,
    onError: optimistic.onError,
    onSettled: () => invalidateWriteback(optimistic.client, issueId),
  });
}
