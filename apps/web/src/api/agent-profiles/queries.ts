import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { useQueryKeys } from "@web/api/use-query-keys";

export function useAgentProfiles(projectId?: string) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.agentProfilesFor(projectId),
    queryFn: () => daemon.listAgentProfiles(projectId),
  });
}
