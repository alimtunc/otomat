import { isWorkspaceCleanable } from "@otomat/domain";
import { Button, Icon } from "@otomat/ui";
import { BulkCleanupDialog } from "@web/components/settings/workspaces/bulk-cleanup-dialog";
import type { WorkspaceRow } from "@web/lib/workspace/row";
import { useState } from "react";

export function BulkCleanupStrip({ rows }: { rows: WorkspaceRow[] }) {
  const [open, setOpen] = useState(false);
  const cleanable = rows.filter(isWorkspaceCleanable);
  // A successful run refetches and empties cleanable; the open dialog must outlive that to show its receipt.
  if (cleanable.length === 0 && !open) return null;
  return (
    <>
      {cleanable.length === 0 ? null : (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-success/40 bg-success-bg px-3.5 py-2.5">
          <p className="min-w-0 flex-1 text-sm text-foreground">
            {cleanable.length === 1
              ? "1 worktree has a merged pull request and is safe to delete."
              : `${cleanable.length} worktrees have merged pull requests and are safe to delete.`}
          </p>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <Icon name="trash-2" aria-hidden />
            Clean up {cleanable.length}
          </Button>
        </div>
      )}
      <BulkCleanupDialog rows={cleanable} open={open} onOpenChange={setOpen} />
    </>
  );
}
