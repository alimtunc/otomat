import { FOCUS_RING, Tooltip, TooltipContent, TooltipTrigger } from "@otomat/ui";
import type { TableCellProps } from "@web/lib/table";
import type { WorkspaceRow } from "@web/lib/workspace/row";

export function WorkspaceGitStateCell({ row }: TableCellProps<WorkspaceRow, unknown>) {
  const { present, dirty } = row.original;
  let git = { word: "clean", detail: "the worktree has no uncommitted change" };
  if (!present) git = { word: "gone", detail: "the worktree is gone from disk" };
  else if (dirty === null) git = { word: "unreadable", detail: "git could not read the worktree" };
  else if (dirty) git = { word: "dirty", detail: "the worktree holds uncommitted changes" };
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            tabIndex={0}
            aria-label={`${git.word} — ${git.detail}`}
            className={`rounded-sm ${FOCUS_RING}`}
          />
        }
      >
        <span className="text-xs text-text-secondary">{git.word}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 whitespace-normal">{git.detail}</TooltipContent>
    </Tooltip>
  );
}
