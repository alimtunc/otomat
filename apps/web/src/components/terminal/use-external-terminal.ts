import type { DaemonClient } from "@otomat/client";
import type { ExecutionHostDescriptor } from "@otomat/domain";
import { toast } from "@otomat/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useQueryKeys } from "@web/api/use-query-keys";
import { useOpenWorkspace } from "@web/api/workspaces/mutations";
import { describeOperationFailure } from "@web/components/shell/remote-session/status-labels";
import { remoteHostAlias } from "@web/lib/active-host";
import { remoteShellCommand, workspaceShellCommand } from "@web/lib/workspace/open";

type ExternalTerminalTarget = { rootPath: string } | { issueId: string };

export function useExternalTerminal(client: DaemonClient, host: ExecutionHostDescriptor) {
  const cache = useQueryClient();
  const keys = useQueryKeys();
  const openWorkspace = useOpenWorkspace();
  return useMutation({
    mutationFn: async (target: ExternalTerminalTarget) => {
      const alias = remoteHostAlias(host.id);
      if (host.id === "remote" && alias === null) throw new Error("Reconnect the SSH host first.");
      if ("rootPath" in target) {
        await navigator.clipboard.writeText(
          alias === null
            ? workspaceShellCommand(target.rootPath)
            : remoteShellCommand(alias, target.rootPath),
        );
        toast.success("Command copied. Paste it in your terminal.");
        return;
      }
      const { workspace_id } = await client.prepareIssueWorkspace(target.issueId);
      const listing = await client.listWorkspaces();
      const entry = listing.entries.find((item) => item.id === workspace_id);
      if (!entry?.present) throw new Error("The host cannot find the canonical worktree.");
      if (alias === null) {
        const result = await openWorkspace.mutateAsync({
          hostId: host.id,
          path: entry.path,
          target: "terminal",
        });
        if (!result.ok) throw new Error(describeOperationFailure(result));
      } else {
        await navigator.clipboard.writeText(remoteShellCommand(alias, entry.path));
        toast.success("SSH command copied. Paste it in your terminal.");
      }
      void cache.invalidateQueries({ queryKey: keys.workspaces });
    },
  });
}
