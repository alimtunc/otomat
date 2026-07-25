import { isRunTerminal, RUN_STATES, type RunContract, type RunState } from "@otomat/domain";

export function isActiveRun(run: RunContract): boolean {
  return !isRunTerminal(run.status);
}

/** States with a provider turn genuinely in flight; a resting run is still active but is not working. */
const WORKING_STATES: ReadonlySet<RunState> = new Set<RunState>(["queued", "preparing", "running"]);

export function isRunWorking(run: RunContract): boolean {
  return WORKING_STATES.has(run.status);
}

export function isRunState(value: unknown): value is RunState {
  return typeof value === "string" && (RUN_STATES as readonly string[]).includes(value);
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
