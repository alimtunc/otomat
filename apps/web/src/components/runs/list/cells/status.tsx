import type { RunContract, RunState } from "@otomat/domain";
import { RunStatusChip } from "@otomat/ui";
import type { TableCellProps } from "@web/lib/table";

export function RunStatusCell({ getValue }: TableCellProps<RunContract, RunState>) {
  return <RunStatusChip status={getValue()} />;
}
