import type { IssueBoardColumn } from "@otomat/domain/types";

import { StatusChip } from "../status-chip";
import type { PresetStatusChipProps } from "./preset-props";

export function IssueStatusChip(props: PresetStatusChipProps<IssueBoardColumn>) {
  return <StatusChip kind="issue" {...props} />;
}
