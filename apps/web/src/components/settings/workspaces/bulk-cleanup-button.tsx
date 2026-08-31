import { isWorkspaceCleanable } from "@otomat/domain";
import { Button, Icon } from "@otomat/ui";
import { BulkCleanupDialog } from "@web/components/settings/workspaces/bulk-cleanup-dialog";
import type { WorkspaceRow } from "@web/lib/workspace/row";
import { useState } from "react";

export function BulkCleanupWorkspacesButton({ rows }: { rows: WorkspaceRow[] }) {
  const [open, setOpen] = useState(false);
  const cleanable = rows.filter(isWorkspaceCleanable);
  // A successful run refetches and empties cleanable; the open dialog must outlive that to show its receipt.
  if (cleanable.length === 0 && !open) return null;
  return (
    <>
      {cleanable.length === 0 ? null : (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Icon name="trash-2" aria-hidden />
          Clean up {cleanable.length}…
        </Button>
      )}
      <BulkCleanupDialog rows={cleanable} open={open} onOpenChange={setOpen} />
    </>
  );
}
