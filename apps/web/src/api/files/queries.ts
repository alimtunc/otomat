import type { CheckoutTarget, WorktreeFileEntry } from "@otomat/domain";
import { skipToken, useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { retryTransportOnly } from "@web/api/query-client";
import { useQueryKeys } from "@web/api/use-query-keys";

export function useFile(target: CheckoutTarget, path: string) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.checkoutFile(target, path),
    queryFn: () => daemon.getCheckoutFile(target, path),
    retry: retryTransportOnly,
  });
}

export function useCheckoutFiles(target: CheckoutTarget | null, enabled: boolean) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey:
      target?.kind === "run" ? keys.runFiles(target.id) : keys.repositoryTree(target?.id ?? null),
    queryFn:
      target === null
        ? skipToken
        : async (): Promise<{ entries: WorktreeFileEntry[] }> =>
            target.kind === "run"
              ? daemon.getRunFiles(target.id)
              : daemon.getRepositoryTree(target.id),
    enabled,
    retry: retryTransportOnly,
  });
}
