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

/**
 * A host that has stopped accepting new agent work, with the runs still in flight on it. Held in
 * the daemon's memory and expiring by itself, so a client that dies mid-install cannot strand it.
 */
export const launchHoldSchema = z.object({
  held: z.boolean(),
  active_runs: z.number().int().nonnegative(),
});
export type LaunchHold = z.infer<typeof launchHoldSchema>;

export const updateLaunchHoldRequestSchema = z.object({ held: z.boolean() }).strict();
export type UpdateLaunchHoldRequest = z.infer<typeof updateLaunchHoldRequestSchema>;
