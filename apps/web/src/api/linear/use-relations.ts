import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { useQueryKeys } from "@web/api/use-query-keys";

export function useLinearRelations(issueId: string) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.linearRelations(issueId),
    queryFn: () => daemon.getLinearRelations(issueId),
    retry: false,
    staleTime: 15_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });
}
