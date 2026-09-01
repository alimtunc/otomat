import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

export function useAgentProfiles(projectId?: string) {
  return useQuery({
    queryKey: queryKeys.agentProfilesFor(projectId),
    queryFn: () => daemon.listAgentProfiles(projectId),
  });
}
