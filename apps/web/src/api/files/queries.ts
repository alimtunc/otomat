import type { CheckoutTarget } from "@otomat/domain";
import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { retryTransportOnly } from "@web/api/query-client";
import { useQueryKeys } from "@web/api/use-query-keys";

export function useFile(target: CheckoutTarget, path: string) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey:
      target.kind === "run" ? keys.runFile(target.id, path) : keys.repositoryFile(target.id, path),
    queryFn: () =>
      target.kind === "run"
        ? daemon.getRunFile(target.id, path)
        : daemon.getRepositoryFile(target.id, path),
    retry: retryTransportOnly,
  });
}
