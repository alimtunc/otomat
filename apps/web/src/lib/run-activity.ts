import { isRunTerminal, type RunContract } from "@otomat/domain";

export function isActiveRun(run: RunContract): boolean {
  return !isRunTerminal(run.status);
}

/**
 * The run whose activity the workspace shows: the user's pick while it is still
 * listed, else the oldest still-active run, else the most recent run, else null.
 */
export function resolveFollowedRun(
  runs: RunContract[],
  selectedId: string | null,
): RunContract | null {
  const selected = runs.find((run) => run.id === selectedId);
  if (selected) return selected;
  return runs.find(isActiveRun) ?? runs.at(-1) ?? null;
}
