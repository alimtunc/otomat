import type { WorkspaceEntry } from "@otomat/domain";
import { RelativeTime } from "@otomat/ui";
import type { TableCellProps } from "@web/lib/table";

export function WorkspaceGitStateCell({ row }: TableCellProps<WorkspaceEntry, unknown>) {
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
