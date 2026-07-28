import type { IssueState } from "@otomat/domain/types";

import { StatusChip } from "../status-chip";
import type { PresetStatusChipProps } from "./preset-props";

export function IssueStatusChip(props: PresetStatusChipProps<IssueState>) {
  return <StatusChip kind="issue" {...props} />;
}
