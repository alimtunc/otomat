import { LINEAR_PRIORITIES, type IssueSource } from "@otomat/domain";

export const SOURCE_OPTIONS: { value: IssueSource; label: string }[] = [
  { value: "linear", label: "Linear" },
  { value: "github", label: "GitHub" },
  { value: "local", label: "Local" },
];

export const PRIORITY_ITEMS = [
  { value: "all", label: "Any priority" },
  ...LINEAR_PRIORITIES.map((priority) => ({
    value: String(priority.value),
    label: priority.label,
  })),
];
