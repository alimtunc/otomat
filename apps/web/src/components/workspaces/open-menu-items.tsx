import type { ExecutionHostDescriptor, WorkspaceEntry, WorkspaceOpenTarget } from "@otomat/domain";
import { DropdownMenuItem, Icon, toast } from "@otomat/ui";
import { useOpenWorkspace } from "@web/api/workspaces/mutations";
import { describeOperationFailure } from "@web/components/shell/remote-session/status-labels";
import { remoteHostAlias } from "@web/lib/active-host";
import { remoteShellCommand, workspaceOpenAvailability } from "@web/lib/workspace/open";

export interface WorkspaceOpenMenuItemsProps {
  entry: WorkspaceEntry | null;
  host: ExecutionHostDescriptor;
}

async function copySshCommand(command: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(command);
    toast.success("ssh command copied");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Clipboard unavailable");
  }
}

export function WorkspaceOpenMenuItems({ entry, host }: WorkspaceOpenMenuItemsProps) {
  const open = useOpenWorkspace();
  const vscode = workspaceOpenAvailability(entry, host, "vscode");
  const terminal = workspaceOpenAvailability(entry, host, "terminal");
  const alias = remoteHostAlias(host.id);
  const sshCommand =
    entry !== null && entry.present && alias !== null
      ? remoteShellCommand(alias, entry.path)
      : null;
  const launch = (target: WorkspaceOpenTarget): void => {
    if (entry === null) return;
    open.mutate(
      { hostId: host.id, path: entry.path, target },
      {
        onSuccess: (result) => {
          if (!result.ok) toast.error(describeOperationFailure(result));
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };
  return (
    <>
      <DropdownMenuItem
        disabled={!vscode.available || open.isPending}
        title={vscode.reason ?? undefined}
        onClick={() => launch("vscode")}
      >
        <Icon name="code" aria-hidden />
        Open in VS Code
      </DropdownMenuItem>
      <DropdownMenuItem
        disabled={!terminal.available || open.isPending}
        title={terminal.reason ?? undefined}
        onClick={() => launch("terminal")}
      >
        <Icon name="terminal" aria-hidden />
        Open in terminal
      </DropdownMenuItem>
      {sshCommand === null ? null : (
        <DropdownMenuItem title={sshCommand} onClick={() => void copySshCommand(sshCommand)}>
          <Icon name="copy" aria-hidden />
          Copy ssh command
        </DropdownMenuItem>
      )}
    </>
  );
}
