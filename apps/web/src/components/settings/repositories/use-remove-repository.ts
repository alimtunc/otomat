import type { ExecutionHostId } from "@otomat/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";
import { deleteRepositoryErrorMessage } from "@web/api/repositories/mutations";
import { describeOperationFailure } from "@web/components/shell/remote-session/status-labels";
import { desktopBridge } from "@web/lib/desktop-bridge";

export interface RemoveRepositoryInput {
  hostId: ExecutionHostId;
  repositoryId: string;
}

export function useRemoveRepository() {
  const bridge = desktopBridge();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ hostId, repositoryId }: RemoveRepositoryInput) => {
      if (bridge === null) {
        try {
          await daemon.deleteRepository(repositoryId);
        } catch (error) {
          throw new Error(deleteRepositoryErrorMessage(error), { cause: error });
        }
        return;
      }
      const result = await bridge.executionHost.deleteRepository(hostId, repositoryId);
      if (!result.ok) throw new Error(describeOperationFailure(result));
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.executionHost });
      void client.invalidateQueries({ queryKey: queryKeys.projects });
      void client.invalidateQueries({ queryKey: queryKeys.repositories });
      void client.invalidateQueries({ queryKey: queryKeys.issues });
      void client.invalidateQueries({ queryKey: queryKeys.runs });
    },
  });
}
