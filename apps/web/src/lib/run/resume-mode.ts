import type { RunResumePlan } from "@otomat/domain";

/** A fallback is never dressed up as a native resume: the reason the session could not be reattached is part of the sentence. */
export function resumeModeNote(plan: RunResumePlan): string {
  if (plan.mode === "native") {
    return "Reattaches the agent's own session — it keeps the context it already had.";
  }
  if (plan.mode === "recovery") {
    return `${plan.reason}. A new session picks the work back up in the same step and worktree, with the run's goal, plan, diff and failure as its context.`;
  }
  if (plan.mode === "next_step") return `Starts the plan's next step, “${plan.step_name}”.`;
  return plan.reason;
}
