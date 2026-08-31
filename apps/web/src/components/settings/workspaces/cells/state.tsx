import type { WorkspaceState } from "@otomat/domain";
import { Chip, FOCUS_RING, Tooltip, TooltipContent, TooltipTrigger } from "@otomat/ui";
import type { TableCellProps } from "@web/lib/table";
import type { WorkspaceRow } from "@web/lib/workspace/row";
import { WORKSPACE_STATE } from "@web/lib/workspace/state";

export function WorkspaceStateCell({
  row,
  getValue,
}: TableCellProps<WorkspaceRow, WorkspaceState>) {
  const state = WORKSPACE_STATE[getValue()];
  const reason = row.original.reason;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          // A tooltip names nothing, so the reason is repeated on the accessible name.
          <span
            tabIndex={0}
            aria-label={`${state.label} — ${reason}`}
            className={`rounded-sm ${FOCUS_RING}`}
          />
        }
      >
        <Chip tone={state.tone}>{state.label}</Chip>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 whitespace-normal">{reason}</TooltipContent>
    </Tooltip>
  );
}
