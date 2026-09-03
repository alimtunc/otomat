import type { LocalWorkSummary } from "./work-summary.js";

const plural = (count: number): string => (count === 1 ? "" : "s");

export function localWorkLines(summary: LocalWorkSummary | null): string[] {
  if (summary === null) return ["Otomat could not read the local daemon's activity."];
  return [
    `${summary.active} run${plural(summary.active)} active`,
    `${summary.waiting} awaiting you`,
    `${summary.failed} failed`,
  ];
}
