import { z } from "zod";

import { resolvedAgentConfigSchema } from "./entities/agents.js";
import {
  AGENT_SELECTION_MESSAGE,
  executionOptionSelectionsSchema,
  selectsOneAgent,
} from "./execution-config.js";
import { modelSelectionSchema } from "./runtime-model.js";

export const SUPERVISION_DEFAULT_MAX_LOOPS = 3;
export const SUPERVISION_MAX_LOOPS_LIMIT = 10;

export const supervisionLimitsSchema = z.object({
  /** Remediation rounds one step may take; the run blocks rather than looping past it. */
  max_loops: z
    .number()
    .int()
    .positive()
    .max(SUPERVISION_MAX_LOOPS_LIMIT)
    .default(SUPERVISION_DEFAULT_MAX_LOOPS),
  /** Ceiling on what the supervisor itself may spend, in USD; null leaves it uncapped. */
  budget_usd: z.number().positive().nullable().default(null),
});

/** `runs.supervision_json` — the supervisor profile resolved and frozen at launch, exactly like a step's. */
export const supervisionSchema = z.object({
  config: resolvedAgentConfigSchema,
  ...supervisionLimitsSchema.shape,
});
export type Supervision = z.infer<typeof supervisionSchema>;

export const supervisionRequestSchema = z
  .object({
    runtime: z.string().min(1).optional(),
    profile_id: z.string().min(1).optional(),
    /** Frozen with the supervisor so a later profile edit cannot change who judged a step. */
    model: modelSelectionSchema.optional(),
    options: executionOptionSelectionsSchema.optional(),
    ...supervisionLimitsSchema.shape,
  })
  .strict()
  .refine(selectsOneAgent, { message: AGENT_SELECTION_MESSAGE });
export type SupervisionRequest = z.infer<typeof supervisionRequestSchema>;

const reasonSchema = z.string().trim().min(1);

/** `needs_changes` carries its remediation instructions, so asking for work without saying which is structurally invalid. */
export const supervisionDecisionSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("pass"), reason: reasonSchema }),
  z.object({
    decision: z.literal("needs_changes"),
    reason: reasonSchema,
    instructions: reasonSchema,
  }),
  z.object({ decision: z.literal("blocked"), reason: reasonSchema }),
]);
export type SupervisionDecision = z.infer<typeof supervisionDecisionSchema>;

const FENCED_BLOCK = /```(?:json)?\s*\n([\s\S]*?)```/g;

function decisionFromBlock(block: string): SupervisionDecision | null {
  try {
    const parsed = supervisionDecisionSchema.safeParse(JSON.parse(block));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Only a well-formed block counts: prose that merely sounds approving must leave the dependency locked. */
export function parseSupervisionDecision(text: string): SupervisionDecision | null {
  const blocks = [...text.matchAll(FENCED_BLOCK)].map((match) => match[1] ?? "");
  for (const block of blocks.toReversed()) {
    const decision = decisionFromBlock(block);
    if (decision !== null) return decision;
  }
  return null;
}
