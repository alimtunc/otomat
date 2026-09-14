import { Button, Popover, PopoverContent, PopoverTrigger } from "@otomat/ui";

export function WorkspaceReconciliationNote({
  id,
  autoDelete,
}: {
  id: string;
  autoDelete: boolean | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 text-xs text-text-secondary">
      <p id={id}>
        Refreshes workspace state.{" "}
        {autoDelete === true
          ? "Auto-delete is on: clean worktrees from merged PRs may be removed."
          : "Clean worktrees from merged PRs may be removed where auto-delete is on."}
      </p>
      <Popover>
        <PopoverTrigger
          render={
            <Button size="xs" variant="ghost">
              Pruning details
            </Button>
          }
        />
        <PopoverContent className="max-w-sm p-3 text-xs text-text-secondary">
          Reconciliation re-reads this host’s pull requests and git worktree list, refreshes
          workspace state, and drops git registrations whose directory is gone. Automatic deletion
          follows each project’s setting.
        </PopoverContent>
      </Popover>
    </div>
  );
}
