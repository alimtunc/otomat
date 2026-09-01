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
    <Chip tone={state.tone} hint={row.original.reason}>
      {state.label}
    </Chip>
  );
}
