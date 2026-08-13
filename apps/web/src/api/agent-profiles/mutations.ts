import type { SaveAgentProfileRequest } from "@otomat/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

function useInvalidateProfiles() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: queryKeys.agentProfiles });
}

export function useCreateAgentProfile() {
  const invalidate = useInvalidateProfiles();
  return useMutation({
    mutationFn: (request: SaveAgentProfileRequest) => daemon.createAgentProfile(request),
    onSuccess: invalidate,
  });
}

export function useUpdateAgentProfile() {
  const invalidate = useInvalidateProfiles();
  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: SaveAgentProfileRequest }) =>
      daemon.updateAgentProfile(id, request),
    onSuccess: invalidate,
  });
}

export function useDuplicateAgentProfile() {
  const invalidate = useInvalidateProfiles();
  return useMutation({
    mutationFn: (id: string) => daemon.duplicateAgentProfile(id),
    onSuccess: invalidate,
  });
}

export function useDeleteAgentProfile() {
  const invalidate = useInvalidateProfiles();
  return useMutation({
    mutationFn: (id: string) => daemon.deleteAgentProfile(id),
    onSuccess: invalidate,
  });
}
