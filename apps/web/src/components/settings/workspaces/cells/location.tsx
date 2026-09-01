import { CopyablePath } from "@web/components/runs/copyable-path";
import type { TableCellProps } from "@web/lib/table";
import type { WorkspaceRow } from "@web/lib/workspace/row";

export function WorkspaceLocationCell({ row }: TableCellProps<WorkspaceRow, unknown>) {
  const { branch, path } = row.original;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span
        title={branch ?? undefined}
        className="min-w-0 shrink-0 basis-2/5 truncate font-mono text-xs text-text-secondary"
      >
        {branch ?? "detached"}
      </span>
      <CopyablePath value={path} label="Worktree path" />
    </span>
  );
}
