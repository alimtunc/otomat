import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

export function useAgentProfiles() {
  return useQuery({
    queryKey: queryKeys.agentProfiles,
    queryFn: () => daemon.listAgentProfiles(),
  });
}
