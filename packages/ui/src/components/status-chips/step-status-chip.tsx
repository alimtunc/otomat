import type { StepRunState } from "@otomat/domain/types";

import { StatusChip } from "../status-chip";
import type { PresetStatusChipProps } from "./preset-props";

export function StepStatusChip(props: PresetStatusChipProps<StepRunState>) {
  return <StatusChip kind="step" {...props} />;
}
