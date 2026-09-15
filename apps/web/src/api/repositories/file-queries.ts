import { skipToken, useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { retryTransportOnly } from "@web/api/query-client";
import { useQueryKeys } from "@web/api/use-query-keys";

export function useRepositoryTree(id: string | null) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.repositoryTree(id),
    queryFn: id === null ? skipToken : () => daemon.getRepositoryTree(id),
    retry: retryTransportOnly,
  });
}
