import { listRuns } from "@otomat/db";
import { isRunBusy, type LaunchHold } from "@otomat/domain";

import { LaunchRefusedError } from "./launch-target.js";
import type { SupervisorState } from "./state.js";

/** The client that armed the hold may be replaced by the very update it armed it for, so it expires. */
const HOLD_WINDOW_MS = 5 * 60_000;

const REFUSAL = "This host is not accepting new work while it is being updated.";

export function launchesHeld(state: SupervisorState): boolean {
  return Date.now() < state.launchHoldUntil;
}

function activeRuns(state: SupervisorState): number {
  return listRuns(state.db).filter((run) => isRunBusy(run.status)).length;
}

/** Arms or lifts the hold and answers with the runs still in flight, so one call closes the race. */
export function setLaunchHold(state: SupervisorState, hold: boolean): LaunchHold {
  state.launchHoldUntil = hold ? Date.now() + HOLD_WINDOW_MS : 0;
  return { held: launchesHeld(state), active_runs: activeRuns(state) };
}

export function requireLaunchable(state: SupervisorState): void {
  if (launchesHeld(state)) throw new LaunchRefusedError("launches_held", REFUSAL);
}
