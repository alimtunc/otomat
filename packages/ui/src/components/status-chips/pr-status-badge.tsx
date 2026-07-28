import type { PullRequestState } from "@otomat/domain/types";

import { StatusChip } from "../status-chip";
import type { PresetStatusChipProps } from "./preset-props";

export function PRStatusBadge(props: PresetStatusChipProps<PullRequestState>) {
  return <StatusChip kind="pr" {...props} />;
}
