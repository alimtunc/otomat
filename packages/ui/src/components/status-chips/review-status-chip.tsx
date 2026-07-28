import type { ReviewState } from "@otomat/domain/types";

import { StatusChip } from "../status-chip";
import type { PresetStatusChipProps } from "./preset-props";

export function ReviewStatusChip(props: PresetStatusChipProps<ReviewState>) {
  return <StatusChip kind="review" {...props} />;
}
