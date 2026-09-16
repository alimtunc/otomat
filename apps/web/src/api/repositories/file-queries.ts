import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { retryTransportOnly } from "@web/api/query-client";
import { useQueryKeys } from "@web/api/use-query-keys";

export function useRepositoryTree(id: string) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.repositoryTree(id),
    queryFn: () => daemon.getRepositoryTree(id),
    retry: retryTransportOnly,
  });
}
