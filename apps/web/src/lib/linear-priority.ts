import { LINEAR_PRIORITIES } from "@otomat/domain";

export function linearPriorityLabel(value: number): string {
  return LINEAR_PRIORITIES.find((priority) => priority.value === value)?.label ?? String(value);
}
