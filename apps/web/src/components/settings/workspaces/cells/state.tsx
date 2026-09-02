import type { WorkspaceState } from "@otomat/domain";
import { Chip } from "@otomat/ui";
import type { TableCellProps } from "@web/lib/table";
import { workspaceReason } from "@web/lib/workspace/blocker";
import type { WorkspaceRow } from "@web/lib/workspace/row";
import { WORKSPACE_STATE } from "@web/lib/workspace/state";

export function WorkspaceStateCell({
  row,
  getValue,
}: TableCellProps<WorkspaceRow, WorkspaceState>) {
  const state = WORKSPACE_STATE[getValue()];
  return (
    <Chip tone={state.tone} hint={workspaceReason(row.original)}>
      {state.label}
    </Chip>
  );
}
