import { FOCUS_RING, LiveDot, Tooltip, TooltipContent, TooltipTrigger } from "@otomat/ui";
import type { TableCellProps } from "@web/lib/table";
import type { WorkspaceRow } from "@web/lib/workspace/row";
import { workspaceGitState } from "@web/lib/workspace/state";

export function WorkspaceGitStateCell({ row }: TableCellProps<WorkspaceRow, unknown>) {
  const git = workspaceGitState(row.original.present, row.original.dirty);
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
        <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
          <LiveDot tone={git.tone} />
          {git.word}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 whitespace-normal">{git.detail}</TooltipContent>
    </Tooltip>
  );
}
