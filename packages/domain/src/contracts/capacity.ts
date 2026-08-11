import { z } from "zod";

/** Slots a daemon that was never configured runs with; existing installs keep it after the setting ships. */
export const DEFAULT_MAX_CONCURRENT_SESSIONS = 4;

/** One host daemon's agent-session capacity; the value lives in that daemon's database, not in a desktop preference. */
export const agentCapacitySchema = z.object({
  max_concurrent_sessions: z.number().int().positive(),
  /** Sessions holding a slot right now; may exceed the cap after it was lowered under live work. */
  active_sessions: z.number().int().nonnegative(),
  waiting_sessions: z.number().int().nonnegative(),
});
export type AgentCapacity = z.infer<typeof agentCapacitySchema>;

export const updateAgentCapacityRequestSchema = z
  .object({ max_concurrent_sessions: z.number().int().positive() })
  .strict();
export type UpdateAgentCapacityRequest = z.infer<typeof updateAgentCapacityRequestSchema>;
