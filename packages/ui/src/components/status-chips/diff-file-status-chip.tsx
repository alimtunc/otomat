import type { ChangeStatus } from "@otomat/domain/types";

import { StatusChip } from "../status-chip";
import type { PresetStatusChipProps } from "./preset-props";

export function DiffFileStatusChip(props: PresetStatusChipProps<ChangeStatus>) {
  return <StatusChip kind="diffFile" {...props} />;
}
