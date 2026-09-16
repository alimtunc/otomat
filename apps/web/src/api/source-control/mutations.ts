import type { ChangeFilesRequest, CheckoutTarget, CommitFilesRequest } from "@otomat/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { invalidateCheckout } from "@web/api/files/invalidate";
import { useQueryKeys } from "@web/api/use-query-keys";

export function useChangeFiles(target: CheckoutTarget) {
  const client = useQueryClient();
  const keys = useQueryKeys();
  return useMutation({
    mutationFn: (request: ChangeFilesRequest) => daemon.changeFiles(target, request),
    onSuccess: () => invalidateCheckout(client, keys, target),
  });
}

export function useCommitFiles(target: CheckoutTarget) {
  const client = useQueryClient();
  const keys = useQueryKeys();
  return useMutation({
    mutationFn: (request: CommitFilesRequest) => daemon.commitFiles(target, request),
    onSuccess: () => invalidateCheckout(client, keys, target),
  });
}
