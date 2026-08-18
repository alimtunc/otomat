import { z } from "zod";

import { LINEAR_WRITE_STATES } from "../entity-states.js";

export const LINEAR_LIFECYCLE_PHASES = ["in_progress", "done"] as const;
export const linearLifecyclePhaseSchema = z.enum(LINEAR_LIFECYCLE_PHASES);
export type LinearLifecyclePhase = z.infer<typeof linearLifecyclePhaseSchema>;

/** Linear's own workflow-state type, so a phase proposes real candidates without ever naming a state. */
export const LIFECYCLE_PHASE_STATE_TYPE: Record<LinearLifecyclePhase, string> = {
  in_progress: "started",
  done: "completed",
};

export interface LinearLifecycleSignal {
  issue_id: string;
  phase: LinearLifecyclePhase;
  run_id: string;
}

/** Fire-and-forget: a tracker write must never block or fail the daemon transition that caused it. */
export type LinearLifecycleSync = (signal: LinearLifecycleSignal) => void;

export const trackerStateRefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});
export type TrackerStateRef = z.infer<typeof trackerStateRefSchema>;

/** A null phase is unmapped, so the daemon writes nothing rather than guessing a state name. */
export const issueSourceLifecycleSchema = z.object({
  in_progress: trackerStateRefSchema.nullable(),
  done: trackerStateRefSchema.nullable(),
});
export type IssueSourceLifecycle = z.infer<typeof issueSourceLifecycleSchema>;

export const UNMAPPED_ISSUE_SOURCE_LIFECYCLE: IssueSourceLifecycle = {
  in_progress: null,
  done: null,
};

export const linearLifecycleReconcileResultSchema = z.object({
  reconciled: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});
export type LinearLifecycleReconcileResult = z.infer<typeof linearLifecycleReconcileResultSchema>;

export const linearLifecycleWriteErrorSchema = z.object({
  issue_id: z.string().min(1),
  write_id: z.string().min(1),
  phase: linearLifecyclePhaseSchema,
  message: z.string().min(1),
});
export type LinearLifecycleWriteError = z.infer<typeof linearLifecycleWriteErrorSchema>;

export const linearLifecycleSyncStateSchema = z.object({
  write_id: z.string().min(1),
  phase: linearLifecyclePhaseSchema,
  target_state_id: z.string().min(1),
  target_state_name: z.string().min(1),
  status: z.enum(LINEAR_WRITE_STATES),
  detail: z.string().nullable(),
  error_code: z.string().nullable(),
  error_message: z.string().nullable(),
  updated_at: z.iso.datetime(),
});
export type LinearLifecycleSyncState = z.infer<typeof linearLifecycleSyncStateSchema>;
