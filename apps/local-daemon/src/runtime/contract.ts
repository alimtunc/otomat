import {
  RUN_TERMINAL_STATES,
  type RuntimeCapabilities,
  type RunTerminalState,
} from "@otomat/domain";
import { z } from "zod";

import type { RuntimeSink } from "./sinks.js";

export type RuntimeId = string;

/** Token/cost/model evidence a runtime reports for a turn. Null fields mean the provider did not report them. */
export const runtimeUsageSchema = z.object({
  model: z.string().nullable(),
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  total_tokens: z.number().int().nonnegative(),
  cost_usd: z.number().nonnegative().nullable(),
});
export type RuntimeUsage = z.infer<typeof runtimeUsageSchema>;

/** Terminal outcomes a runtime can return: the run machine's terminal states. */
export const RUNTIME_FINAL_STATUSES = RUN_TERMINAL_STATES;
const runtimeFinalStatusSchema = z.enum(RUNTIME_FINAL_STATUSES);
export type RuntimeFinalStatus = RunTerminalState;

export const runtimeFinalStateSchema = z.object({
  status: runtimeFinalStatusSchema,
  provider_session_id: z.string().nullable(),
  usage: runtimeUsageSchema.nullable(),
  error: z.object({ message: z.string() }).nullable(),
  event_count: z.number().int().nonnegative(),
});
export type RuntimeFinalState = z.infer<typeof runtimeFinalStateSchema>;

/** Inputs to a fresh run. `run_dir` is the per-run artifact directory. */
const runtimeRunInputSchema = z.object({
  run_id: z.string(),
  step_run_id: z.string(),
  agent_session_id: z.string(),
  prompt: z.string(),
  run_dir: z.string(),
  cwd: z.string().nullable().optional(),
});
export type RuntimeRunInput = z.infer<typeof runtimeRunInputSchema>;

/** Inputs to a follow-up turn that resumes an existing provider session. */
const runtimeResumeInputSchema = z.object({
  prompt: z.string(),
  run_dir: z.string(),
  cwd: z.string().nullable().optional(),
});
export type RuntimeResumeInput = z.infer<typeof runtimeResumeInputSchema>;

/** Handle to a started session, used by out-of-band `abort`/`resume`. */
const runtimeSessionRefSchema = z.object({
  run_id: z.string(),
  step_run_id: z.string(),
  agent_session_id: z.string(),
  provider_session_id: z.string().nullable(),
});
export type RuntimeSessionRef = z.infer<typeof runtimeSessionRefSchema>;

/**
 * Thin push-sink runtime boundary. `run` executes a turn and resolves on a
 * terminal state, pushing all evidence through `sink` as it goes. Live controls
 * are optional capabilities, not assumed; there is no mid-turn steering — a
 * follow-up message is a new turn via `resume`.
 */
export interface RuntimeAdapter {
  readonly id: RuntimeId;
  readonly displayName: string;
  readonly capabilities: RuntimeCapabilities;
  run(input: RuntimeRunInput, sink: RuntimeSink, signal: AbortSignal): Promise<RuntimeFinalState>;
  resume?(
    session: RuntimeSessionRef,
    input: RuntimeResumeInput,
    sink: RuntimeSink,
    signal: AbortSignal,
  ): Promise<RuntimeFinalState>;
  abort?(session: RuntimeSessionRef, reason: string): Promise<void>;
}
