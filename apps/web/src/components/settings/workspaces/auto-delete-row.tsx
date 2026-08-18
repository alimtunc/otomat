import { ErrorState, Skeleton, Switch } from "@otomat/ui";
import { useSetWorkspaceSettings } from "@web/api/workspaces/mutations";
import { useWorkspaceSettings } from "@web/api/workspaces/queries";
import { AppearanceRow } from "@web/components/settings/appearance-row";

export function AutoDeleteWorkspacesRow() {
  const settings = useWorkspaceSettings();
  const save = useSetWorkspaceSettings();

  if (settings.isError && settings.data === undefined) {
    return (
      <ErrorState
        variant="inline"
        title="Couldn’t load the workspace settings"
        onRetry={() => void settings.refetch()}
      />
    );
  }
  return (
    <AppearanceRow
      label="Automatically delete workspaces after merge"
      description="A merged canonical pull request removes its clean worktree. Off, the cycle still closes and the workspace waits in Cleanup required."
      control={
        settings.data === undefined ? (
          <Skeleton height={20} width={36} />
        ) : (
          <Switch
            checked={settings.data.auto_delete_after_merge}
            disabled={save.isPending}
            aria-label="Automatically delete workspaces after merge"
            onCheckedChange={(auto) => save.mutate({ auto_delete_after_merge: auto })}
          />
        )
      }
    />
  );
}
