import { isWorkspaceCleanable, type WorkspaceEntry } from "@otomat/domain";
import { Button } from "@otomat/ui";
import { CleanWorkspaceDialog } from "@web/components/runs/actions/clean-workspace-dialog";
import type { TableCellProps } from "@web/lib/table";
import { useState } from "react";

export function WorkspaceActionsCell({ row }: TableCellProps<WorkspaceEntry, unknown>) {
  const [cleaning, setCleaning] = useState(false);
  const entry = row.original;
  if (!isWorkspaceCleanable(entry)) return null;
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setCleaning(true)}>
        Clean…
      </Button>
      <CleanWorkspaceDialog entry={entry} open={cleaning} onOpenChange={setCleaning} />
    </>
  );
}
