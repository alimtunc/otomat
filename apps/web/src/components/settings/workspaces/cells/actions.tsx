import { isWorkspaceCleanable } from "@otomat/domain";
import { Icon, IconButton } from "@otomat/ui";
import { CleanWorkspaceDialog } from "@web/components/runs/actions/clean-workspace-dialog";
import type { TableCellProps } from "@web/lib/table";
import type { WorkspaceRow } from "@web/lib/workspace/row";
import { useState } from "react";

export function WorkspaceActionsCell({ row }: TableCellProps<WorkspaceRow, unknown>) {
  const [cleaning, setCleaning] = useState(false);
  const workspace = row.original;
  if (!isWorkspaceCleanable(workspace)) return null;
  return (
    <span className="inline-flex opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100">
      <IconButton
        label="Delete this workspace…"
        size="sm"
        icon={<Icon name="trash-2" aria-hidden />}
        onClick={() => setCleaning(true)}
      />
      <CleanWorkspaceDialog
        entry={workspace}
        hostId={workspace.host.id}
        open={cleaning}
        onOpenChange={setCleaning}
      />
    </span>
  );
}
