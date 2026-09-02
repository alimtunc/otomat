import { CopyablePath } from "@web/components/runs/copyable-path";
import type { TableCellProps } from "@web/lib/table";
import type { WorkspaceRow } from "@web/lib/workspace/row";

export function WorkspacePathCell({ row }: TableCellProps<WorkspaceRow, unknown>) {
  return <CopyablePath value={row.original.path} label="Worktree path" />;
}
