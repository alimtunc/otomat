import { RelativeTime } from "@otomat/ui";
import type { TableCellProps } from "@web/lib/table";
import type { WorkspaceRow } from "@web/lib/workspace/row";

export function WorkspaceGitStateCell({ row }: TableCellProps<WorkspaceRow, unknown>) {
  const { present, dirty, last_activity_at: lastActivity } = row.original;
  let git = "clean";
  if (!present) git = "gone from disk";
  else if (dirty === null) git = "unreadable";
  else if (dirty) git = "uncommitted changes";
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="truncate text-xs text-text-secondary">{git}</span>
      {lastActivity === null ? null : (
        <span className="text-micro text-text-tertiary">
          <RelativeTime date={lastActivity} />
        </span>
      )}
    </span>
  );
}
