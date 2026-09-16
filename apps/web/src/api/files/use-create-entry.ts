import type {
  CheckoutTarget,
  CreateWorktreeEntryRequest,
  RepositoryTreeResponse,
  WorktreeFilesResponse,
} from "@otomat/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { invalidateCheckout } from "@web/api/files/invalidate";
import { useQueryKeys } from "@web/api/use-query-keys";

export function useCreateEntry(target: CheckoutTarget) {
  const client = useQueryClient();
  const keys = useQueryKeys();
  return useMutation({
    mutationFn: (request: CreateWorktreeEntryRequest) =>
      daemon.createCheckoutEntry(target, request),
    onSuccess: (entry) => {
      const queryKey =
        target.kind === "run" ? keys.runFiles(target.id) : keys.repositoryTree(target.id);
      client.setQueryData<RepositoryTreeResponse | WorktreeFilesResponse>(queryKey, (current) =>
        current === undefined
          ? undefined
          : {
              ...current,
              entries: [...current.entries.filter((item) => item.path !== entry.path), entry],
            },
      );
      invalidateCheckout(client, keys, target);
    },
  });
}
