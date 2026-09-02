import type { TableCellProps } from "@web/lib/table";
import type { WorkspaceRow } from "@web/lib/workspace/row";

export function WorkspaceBranchCell({ row }: TableCellProps<WorkspaceRow, unknown>) {
  const branch = row.original.branch;
  return (
    <span
      title={branch ?? undefined}
      className="block truncate font-mono text-xs text-text-secondary"
    >
      {branch ?? "detached"}
    </span>
  );
}
