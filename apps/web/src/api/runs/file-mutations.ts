import type { SaveWorktreeFileRequest, WorktreeFileContent } from "@otomat/domain";
import { toast } from "@otomat/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { useQueryKeys } from "@web/api/use-query-keys";
import { worktreeFileMessage, worktreeFileRefusal } from "@web/lib/run/file-refusal";

/** A stale revision is shown inside the editor, where the reader can reload; every other refusal is a toast. */
export function useSaveRunFile(runId: string) {
  const client = useQueryClient();
  const keys = useQueryKeys();
  return useMutation({
    mutationFn: (request: SaveWorktreeFileRequest) => daemon.saveRunFile(runId, request),
    onSuccess: (saved, request) => {
      client.setQueryData(
        keys.runFile(runId, saved.path),
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
      client.invalidateQueries({ queryKey: keys.runFiles(runId) });
      client.invalidateQueries({ queryKey: keys.reviewDiffs({ kind: "run", id: runId }) });
      client.invalidateQueries({ queryKey: keys.runWorkspace(runId) });
    },
    onError: (error) => {
      if (worktreeFileRefusal(error) === "file_revision_stale") return;
      toast.error(worktreeFileMessage(error, "Could not save the file — is the daemon running?"));
    },
  });
}
