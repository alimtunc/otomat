import type { LocalWorkItem, LocalWorkState } from "./work-items.js";

const plural = (count: number): string => (count === 1 ? "" : "s");

export function localWorkLines(items: readonly LocalWorkItem[] | null): string[] {
  if (items === null) return ["Otomat could not read the local daemon's activity."];
  const count = (state: LocalWorkState): number =>
    items.filter((item) => item.state === state).length;
  const active = count("running");
  return [
    `${active} run${plural(active)} active`,
    `${count("waiting")} awaiting you`,
    `${count("failed")} failed`,
  ];
}
