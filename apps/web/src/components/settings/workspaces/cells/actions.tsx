import { isWorkspaceForceCleanable } from "@otomat/domain";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Icon,
  IconButton,
} from "@otomat/ui";
import { WorkspaceCleanupDialog } from "@web/components/workspaces/cleanup-dialog";
import { WorkspaceOpenMenuItems } from "@web/components/workspaces/open-menu-items";
import { desktopBridge } from "@web/lib/desktop-bridge";
import type { TableCellProps } from "@web/lib/table";
import type { WorkspaceRow } from "@web/lib/workspace/row";
import { useState } from "react";

export function WorkspaceActionsCell({ row }: TableCellProps<WorkspaceRow, unknown>) {
  const [cleaning, setCleaning] = useState(false);
  const workspace = row.original;
  const cleanable = isWorkspaceForceCleanable(workspace);
  const openable = desktopBridge() !== null;
  if (!cleanable && !openable) return null;
  return (
    <span className="inline-flex opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100">
      {openable ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <IconButton
                label="Open this workspace"
                size="sm"
                icon={<Icon name="folder-open" aria-hidden />}
              />
            }
          />
          <DropdownMenuContent align="end">
            <WorkspaceOpenMenuItems entry={workspace} host={workspace.host} />
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {cleanable ? (
        <>
          <IconButton
            label="Delete this workspace…"
            size="sm"
            icon={<Icon name="trash-2" aria-hidden />}
            onClick={() => setCleaning(true)}
          />
          <WorkspaceCleanupDialog rows={[workspace]} open={cleaning} onOpenChange={setCleaning} />
        </>
      ) : null}
    </span>
  );
}
