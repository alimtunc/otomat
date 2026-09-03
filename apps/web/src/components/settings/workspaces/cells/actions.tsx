import { isWorkspaceForceCleanable } from "@otomat/domain";
import { Icon, IconButton } from "@otomat/ui";
import { WorkspaceCleanupDialog } from "@web/components/workspaces/cleanup-dialog";
import type { TableCellProps } from "@web/lib/table";
import type { WorkspaceRow } from "@web/lib/workspace/row";
import { useState } from "react";

export function WorkspaceActionsCell({ row }: TableCellProps<WorkspaceRow, unknown>) {
  const [cleaning, setCleaning] = useState(false);
  const workspace = row.original;
  if (!isWorkspaceForceCleanable(workspace)) return null;
  return (
    <span className="inline-flex opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100">
      <IconButton
        label="Delete this workspace…"
        size="sm"
        icon={<Icon name="trash-2" aria-hidden />}
        onClick={() => setCleaning(true)}
      />
      <WorkspaceCleanupDialog rows={[workspace]} open={cleaning} onOpenChange={setCleaning} />
    </span>
  );
}
