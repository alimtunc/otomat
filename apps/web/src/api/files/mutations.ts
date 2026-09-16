import type { CheckoutTarget, SaveWorktreeFileRequest, WorktreeFileContent } from "@otomat/domain";
import { toast } from "@otomat/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { invalidateCheckout } from "@web/api/files/invalidate";
import { useQueryKeys } from "@web/api/use-query-keys";
import { worktreeFileMessage, worktreeFileRefusal } from "@web/lib/run/file-refusal";

/** A stale revision is shown inside the editor, where the reader can reload; every other refusal is a toast. */
export function useSaveFile(target: CheckoutTarget) {
  const client = useQueryClient();
  const keys = useQueryKeys();
  return useMutation({
    mutationFn: (request: SaveWorktreeFileRequest) => daemon.saveCheckoutFile(target, request),
    onSuccess: (saved, request) => {
      client.setQueryData(
        keys.checkoutFile(target, saved.path),
        (current: WorktreeFileContent | undefined) =>
          current?.kind === "text"
            ? {
                ...current,
                revision: saved.revision,
                text: request.text,
                bytes: new TextEncoder().encode(request.text).length,
              }
            : current,
      );
      invalidateCheckout(client, keys, target);
    },
    onError: (error) => {
      if (worktreeFileRefusal(error) === "file_revision_stale") return;
      toast.error(worktreeFileMessage(error, "Could not save the file — is the daemon running?"));
    },
  });
}
