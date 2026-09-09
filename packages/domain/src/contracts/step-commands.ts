import { z } from "zod";

import { CONTEXT_NOTE_MAX_LENGTH } from "../context/limits.js";
import { providerOptionsSchema } from "./provider-options.js";
import { modelIdSchema } from "./runtime-model.js";

/** Close a step the delivery guard holds, on the operator's explicit decision. */
export const overrideStepDeliveryRequestSchema = z
  .object({
    /** Why the operator accepted it anyway; the exception is only auditable with it. */
    note: z.string().trim().min(1).max(CONTEXT_NOTE_MAX_LENGTH),
  })
  .strict();
export type OverrideStepDeliveryRequest = z.infer<typeof overrideStepDeliveryRequestSchema>;

/** Why an override was refused. Each is caller-fixable: the wrong step, a step nothing holds, or a live writer. */
export const RUN_STEP_OVERRIDE_ERRORS = [
  "step_not_found",
  "step_not_blocked",
  "workspace_busy",
] as const;
export type RunStepOverrideErrorCode = (typeof RUN_STEP_OVERRIDE_ERRORS)[number];

export const setNextTurnModelRequestSchema = z
  .object({
    agent_session_id: z.string().min(1),
    current_config_hash: z.string().min(1),
    model: modelIdSchema.nullable(),
    options: providerOptionsSchema,
  })
  .strict();
export type SetNextTurnModelRequest = z.infer<typeof setNextTurnModelRequestSchema>;

export const NEXT_TURN_MODEL_ERRORS = [
  "step_not_found",
  "session_not_found",
  "session_changed",
  "config_changed",
  "config_unavailable",
  "resume_model_unsupported",
] as const;
export const nextTurnModelErrorSchema = z.object({
  error: z.enum(NEXT_TURN_MODEL_ERRORS),
  message: z.string().min(1),
});
