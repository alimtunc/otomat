import { isWorkspaceCleanable } from "@otomat/domain";
import { Button } from "@otomat/ui";
import { CleanWorkspaceDialog } from "@web/components/runs/actions/clean-workspace-dialog";
import type { TableCellProps } from "@web/lib/table";
import type { WorkspaceRow } from "@web/lib/workspace/row";
import { useState } from "react";

export function WorkspaceActionsCell({ row }: TableCellProps<WorkspaceRow, unknown>) {
  const [cleaning, setCleaning] = useState(false);
  const workspace = row.original;
  if (!isWorkspaceCleanable(workspace)) return null;
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setCleaning(true)}>
        Clean…
      </Button>
      <CleanWorkspaceDialog
        entry={workspace}
        hostId={workspace.host.id}
        open={cleaning}
        onOpenChange={setCleaning}
      />
    </>
  );
}
