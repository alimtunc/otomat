import type { ReviewCommentState } from "@otomat/domain/types";

import { StatusChip } from "../status-chip";
import type { PresetStatusChipProps } from "./preset-props";

export function ReviewCommentStatusChip(props: PresetStatusChipProps<ReviewCommentState>) {
  return <StatusChip kind="reviewComment" {...props} />;
}
