import type { ExecutionHostId } from "@otomat/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { hostKeys, shellKeys } from "@web/api/query-keys";
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
    onSuccess: (_result, { hostId }) => {
      const keys = hostKeys(hostId);
      void client.invalidateQueries({ queryKey: shellKeys.executionHost });
      void client.invalidateQueries({ queryKey: keys.projects });
      void client.invalidateQueries({ queryKey: keys.repositories });
      void client.invalidateQueries({ queryKey: keys.issues });
      void client.invalidateQueries({ queryKey: keys.runs });
    },
  });
}
