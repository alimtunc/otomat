import { stepPassBounds, type RunDetail } from "@otomat/domain";

export interface RunDiffStep {
  id: string;
  name: string;
  /** 1-based plan position, matching the `step_number` the daemon answers a step scope with. */
  number: number;
  reconstructable: boolean;
}

export function runDiffSteps(detail: RunDetail): RunDiffStep[] {
  return detail.steps.map((step) => ({
    id: step.id,
    name: step.name,
    number: step.idx + 1,
    reconstructable:
      stepPassBounds(
        detail.sessions.filter((session) => session.step_run_id === step.id).map((s) => s.boundary),
      ) !== null,
  }));
}
