import { isRunSettled, RUN_STATES, type RunContract, type RunState } from "@otomat/domain";

export function isActiveRun(run: RunContract): boolean {
  return !isRunSettled(run.status);
}

export function isRunState(value: unknown): value is RunState {
  return RUN_STATES.some((state) => state === value);
}

/** `runs` is oldest-first: the first still-active run is the oldest, and the last entry the most recent. */
export function resolveFollowedRun(
  runs: RunContract[],
  selectedId: string | null,
): RunContract | null {
  const selected = runs.find((run) => run.id === selectedId);
  if (selected) return selected;
  return runs.find(isActiveRun) ?? runs.at(-1) ?? null;
}
