import type { RunState } from "@otomat/domain/types";

import { StatusChip } from "../status-chip";
import type { PresetStatusChipProps } from "./preset-props";

export function RunStatusChip(props: PresetStatusChipProps<RunState>) {
  return <StatusChip kind="run" {...props} />;
}
