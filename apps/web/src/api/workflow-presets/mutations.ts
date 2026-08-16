import type { DuplicateWorkflowPresetRequest, SaveWorkflowPresetRequest } from "@otomat/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

/** A write can move a preset between scopes, so every scoped list is refreshed, not just the one shown. */
function useInvalidatePresets() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: queryKeys.workflowPresets });
}

export function useCreateWorkflowPreset() {
  const invalidate = useInvalidatePresets();
  return useMutation({
    mutationFn: (request: SaveWorkflowPresetRequest) => daemon.createWorkflowPreset(request),
    onSuccess: invalidate,
  });
}

export function useUpdateWorkflowPreset() {
  const invalidate = useInvalidatePresets();
  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: SaveWorkflowPresetRequest }) =>
      daemon.updateWorkflowPreset(id, request),
    onSuccess: invalidate,
  });
}

export function useDuplicateWorkflowPreset() {
  const invalidate = useInvalidatePresets();
  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: DuplicateWorkflowPresetRequest }) =>
      daemon.duplicateWorkflowPreset(id, request),
    onSuccess: invalidate,
  });
}

export function useDeleteWorkflowPreset() {
  const invalidate = useInvalidatePresets();
  return useMutation({
    mutationFn: (id: string) => daemon.deleteWorkflowPreset(id),
    onSuccess: invalidate,
  });
}
