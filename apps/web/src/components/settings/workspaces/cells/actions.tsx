import { isWorkspaceForceCleanable } from "@otomat/domain";
import {
  CopyButton,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuSeparator,
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
import { useRef, useState } from "react";

export function WorkspaceActionsCell({ row }: TableCellProps<WorkspaceRow, unknown>) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [cleaning, setCleaning] = useState(false);
  const workspace = row.original;
  const cleanable = isWorkspaceForceCleanable(workspace);
  const removable = workspace.state === "unmanaged" && cleanable;
  const openable = desktopBridge() !== null;
  return (
    <span className="inline-flex items-center">
      {removable ? (
        <IconButton
          ref={trigger}
          label="Remove worktree"
          size="sm"
          icon={<Icon name="trash-2" aria-hidden />}
          onClick={() => setCleaning(true)}
        />
      ) : null}
      <CopyButton value={workspace.path} label="Copy Worktree path" />
      <DropdownMenu>
        <DropdownMenuTrigger
          ref={removable ? undefined : trigger}
          render={
            <IconButton
              label="Workspace actions"
              size="sm"
              icon={<Icon name="more-horizontal" aria-hidden />}
            />
          }
        />
        <DropdownMenuContent align="end" className="max-w-sm">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="whitespace-normal break-all font-mono">
              {workspace.path}
              <span className="block" />
              {workspace.branch ?? "detached"}
            </DropdownMenuLabel>
            {openable ? <WorkspaceOpenMenuItems entry={workspace} host={workspace.host} /> : null}
            {cleanable && !removable ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setCleaning(true)}>
                  Delete this workspace…
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {cleanable ? (
        <WorkspaceCleanupDialog
          finalFocus={trigger}
          rows={[workspace]}
          open={cleaning}
          onOpenChange={setCleaning}
        />
      ) : null}
    </span>
  );
}
