import type { RunContributionState } from "@otomat/domain/types";

import { StatusChip } from "../status-chip";
import type { PresetStatusChipProps } from "./preset-props";

export function RunContributionStatusChip(props: PresetStatusChipProps<RunContributionState>) {
  return <StatusChip kind="runContribution" {...props} />;
}
