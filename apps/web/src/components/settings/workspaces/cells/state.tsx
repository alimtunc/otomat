import type { WorkspaceState } from "@otomat/domain";
import { FOCUS_RING, TONE_TEXT, Tooltip, TooltipContent, TooltipTrigger } from "@otomat/ui";
import type { TableCellProps } from "@web/lib/table";
import { workspaceReason } from "@web/lib/workspace/blocker";
import type { WorkspaceRow } from "@web/lib/workspace/row";
import { WORKSPACE_STATE } from "@web/lib/workspace/state";

export function WorkspaceStateCell({
  row,
  getValue,
}: TableCellProps<WorkspaceRow, WorkspaceState>) {
  const state = WORKSPACE_STATE[getValue()];
  const reason = workspaceReason(row.original);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span tabIndex={0} className={FOCUS_RING} aria-label={`${state.label}: ${reason}`} />
        }
      >
        <span
          role="status"
          className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs ${TONE_TEXT[state.tone]}`}
        >
          <span aria-hidden className="size-1.5 rounded-full bg-current" />
          {state.label}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 whitespace-normal">{reason}</TooltipContent>
    </Tooltip>
  );
}
