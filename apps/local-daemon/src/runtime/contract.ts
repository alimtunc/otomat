import {
  modelIdSchema,
  providerOptionsSchema,
  RUN_SETTLED_STATES,
  type BinaryProbe,
  type ProviderOptionDescriptor,
  type ProviderOptions,
  type RuntimeCapabilities,
} from "@otomat/domain";
import { z } from "zod";

import type { RuntimeModelSupport } from "./models/support.js";
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

/** Final outcomes a runtime can return: the run machine's settled states. */
const runtimeFinalStatusSchema = z.enum(RUN_SETTLED_STATES);

export const runtimeFinalStateSchema = z.object({
  status: runtimeFinalStatusSchema,
  provider_session_id: z.string().nullable(),
  usage: runtimeUsageSchema.nullable(),
  error: z.object({ message: z.string() }).nullable(),
  event_count: z.number().int().nonnegative(),
});
export type RuntimeFinalState = z.infer<typeof runtimeFinalStateSchema>;

/** Inputs to a fresh run. `run_dir` is the per-run artifact directory. `options` are the frozen provider options the adapter maps to CLI flags. */
const runtimeRunInputSchema = z.object({
  run_id: z.string(),
  step_run_id: z.string(),
  agent_session_id: z.string(),
  prompt: z.string(),
  run_dir: z.string(),
  /** Worktree the turn executes in; a run that cannot own one is refused at launch, so it is never absent. */
  cwd: z.string().min(1),
  options: providerOptionsSchema.optional(),
  /** Frozen model id for the turn; absent or null sends no model flag and lets the provider default apply. */
  model: modelIdSchema.nullish(),
});
export type RuntimeRunInput = z.infer<typeof runtimeRunInputSchema>;

/** Inputs to a follow-up turn that resumes an existing provider session. */
const runtimeResumeInputSchema = z.object({
  prompt: z.string(),
  run_dir: z.string(),
  cwd: z.string().min(1),
  options: providerOptionsSchema.optional(),
  model: modelIdSchema.nullish(),
});
export type RuntimeResumeInput = z.infer<typeof runtimeResumeInputSchema>;

/**
 * What an adapter feature-detected from the installed binary for one model: the
 * probe's verdict and the options it may honestly offer. A non-`ok` detection
 * carries no options, and the runtime still launches on its provider defaults.
 */
export interface RuntimeOptionSupport {
  detection: BinaryProbe;
  options: ProviderOptionDescriptor[];
}

/** Argv for one non-interactive turn, plus the reasoning level it actually sends, kept for the audit. */
export interface RuntimeOneShot {
  command: string;
  args: string[];
  effort: string | null;
}

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
  /** What the installed binary accepts for `model`, feature-detected per call. Never a union assumed valid across CLI versions. */
  describeOptions(model: string | null): RuntimeOptionSupport;
  /** How this adapter handles model selection: whether it passes a model flag, and where its catalog comes from. */
  readonly models: RuntimeModelSupport;
  /** How to ask this runtime one question that answers on stdout and writes nothing; absent when it has no such mode. */
  describeOneShot?(model: string | null, options: ProviderOptions): RuntimeOneShot;
  run(input: RuntimeRunInput, sink: RuntimeSink, signal: AbortSignal): Promise<RuntimeFinalState>;
  resume?(
    session: RuntimeSessionRef,
    input: RuntimeResumeInput,
    sink: RuntimeSink,
    signal: AbortSignal,
  ): Promise<RuntimeFinalState>;
  abort?(session: RuntimeSessionRef, reason: string): Promise<void>;
}
