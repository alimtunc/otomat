import { isWorkspaceAutoDeletable } from "@otomat/domain";
import { Button, Icon } from "@otomat/ui";
import type { RowSelectionState } from "@tanstack/react-table";
import { WorkspaceCleanupDialog } from "@web/components/workspaces/cleanup-dialog";
import { plural } from "@web/lib/plural";
import type { WorkspaceRow } from "@web/lib/workspace/row";
import { useState, type Dispatch, type SetStateAction } from "react";

function mergedSentence(count: number): string {
  return count === 1
    ? "1 worktree has a merged pull request and is safe to delete."
    : `${count} worktrees have merged pull requests and are safe to delete.`;
}

export interface WorkspaceBulkBarProps {
  rows: WorkspaceRow[];
  selection: RowSelectionState;
  onSelectionChange: Dispatch<SetStateAction<RowSelectionState>>;
}

export function WorkspaceBulkBar({ rows, selection, onSelectionChange }: WorkspaceBulkBarProps) {
  const [open, setOpen] = useState(false);
  const selected = rows.filter((row) => selection[row.id] === true);
  const merged = rows.filter(isWorkspaceAutoDeletable);

  return (
    <>
      {selected.length === 0 && merged.length === 0 ? null : (
        <div className="flex flex-wrap items-center gap-3 border-b border-border-subtle px-4.5 py-2.5">
          <p className="m-0 min-w-0 flex-1 text-sm text-foreground">
            {selected.length > 0
              ? `${plural(selected.length, "workspace")} selected`
              : mergedSentence(merged.length)}
          </p>
          {selected.length === 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onSelectionChange(Object.fromEntries(merged.map((row) => [row.id, true])))
              }
            >
              Select the {merged.length} safe to delete
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => onSelectionChange({})}>
                Clear
              </Button>
              <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
                <Icon name="trash-2" aria-hidden />
                Clean up {selected.length}
              </Button>
            </>
          )}
        </div>
      )}
      {/* Outside the bar: a successful run empties the selection, and the receipt must outlive that. */}
      <WorkspaceCleanupDialog
        rows={selected}
        open={open}
        onOpenChange={setOpen}
        onCleaned={() => onSelectionChange({})}
      />
    </>
  );
}
