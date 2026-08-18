import type { WorkspaceEntry } from "@otomat/domain";
import { CopyablePath } from "@web/components/runs/copyable-path";
import type { TableCellProps } from "@web/lib/table";

export function WorkspaceLocationCell({ row }: TableCellProps<WorkspaceEntry, unknown>) {
  const { branch, path } = row.original;
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="truncate font-mono text-xs text-text-secondary">{branch ?? "detached"}</span>
      <CopyablePath value={path} label="Worktree path" />
    </span>
  );
}
