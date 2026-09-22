import {
  waitablePlanNodes,
  type AppendRunStepRequest,
  type RunDetail,
  type WaitablePlanNode,
} from "@otomat/domain";

export interface StepSchedule {
  mode: "after" | "parallel";
  /** Null picks the last node the step can still wait on. */
  after: string | null;
  confirmed: boolean;
}

export const DEFAULT_STEP_SCHEDULE: StepSchedule = {
  mode: "after",
  after: null,
  confirmed: false,
};

export function scheduleCandidates(detail: RunDetail): WaitablePlanNode[] {
  return waitablePlanNodes(
    detail.run.plan_json,
    new Map(detail.steps.map((step) => [step.id, step.status])),
    new Map(detail.compete_groups.map((group) => [group.id, group.status])),
  );
}

export function scheduledAfter(
  schedule: StepSchedule,
  candidates: readonly WaitablePlanNode[],
): WaitablePlanNode | null {
  return (
    candidates.find((candidate) => candidate.node.id === schedule.after) ??
    candidates.at(-1) ??
    null
  );
}

export function scheduleReady(schedule: StepSchedule): boolean {
  return schedule.mode !== "parallel" || schedule.confirmed;
}

export function scheduleRequestFields(
  schedule: StepSchedule,
  candidates: readonly WaitablePlanNode[],
): Pick<AppendRunStepRequest, "depends_on" | "parallel"> {
  if (schedule.mode === "parallel") return { depends_on: [], parallel: true };
  const after = scheduledAfter(schedule, candidates);
  return { depends_on: after === null ? [] : [after.node.id], parallel: false };
}
