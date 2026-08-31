import type { WorkspaceState } from "@otomat/domain";
import { Chip } from "@otomat/ui";
import type { TableCellProps } from "@web/lib/table";
import type { WorkspaceRow } from "@web/lib/workspace/row";
import { WORKSPACE_STATE } from "@web/lib/workspace/state";

export function WorkspaceStateCell({
  row,
  getValue,
}: TableCellProps<WorkspaceRow, WorkspaceState>) {
  const state = WORKSPACE_STATE[getValue()];
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <Chip tone={state.tone}>{state.label}</Chip>
      <span className="truncate text-micro text-text-tertiary" title={row.original.reason}>
        {row.original.reason}
      </span>
    </span>
  );
}
