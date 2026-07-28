import type { ChipSize } from "../chip";

export interface PresetStatusChipProps<S> {
  status: S;
  size?: ChipSize;
  showLabel?: boolean;
  className?: string;
}
