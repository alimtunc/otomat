import { z } from "zod";

/**
 * Sources of truth that emit events into the ledger. `otomat` is the control
 * plane itself; runtimes and external providers are distinct sources so the UI
 * can render provenance honestly.
 */
export const EVENT_SOURCES = [
  "otomat",
  "claude",
  "codex",
  "git",
  "github",
  "linear",
  "system",
] as const;

export type EventSource = (typeof EVENT_SOURCES)[number];

/** Normalized event families. Raw provider frames are preserved via `raw_ref`. */
export const EVENT_TYPES = [
  "run.lifecycle",
  "run.contribution",
  "run.plan_revised",
  "step.lifecycle",
  "session.lifecycle",
  "session.model_override",
  "compete.lifecycle",
  "runtime.log",
  "runtime.message",
  "runtime.tool_call",
  "runtime.permission_request",
  "runtime.permission_response",
  "runtime.usage",
  "runtime.provider_session",
  "runtime.provider_limit",
  "git.diff_updated",
  "review.comment_created",
  "review.comment_resolved",
  "review.comment_published",
  "pr.created",
  "pr.updated",
  "linear.lifecycle_synced",
  "linear.status_published",
  "linear.comment_published",
  "linear.pr_link_published",
  "system.reconciled",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const eventEnvelopeSchema = z.object({
  id: z.string(),
  run_id: z.string(),
  step_run_id: z.string().nullable(),
  agent_session_id: z.string().nullable(),
  /** Per-run sequence number; a run's events are ordered by ascending `seq`. */
  seq: z.number().int().nonnegative(),
  type: z.enum(EVENT_TYPES),
  source: z.enum(EVENT_SOURCES),
  occurred_at: z.iso.datetime(),
  payload: z.record(z.string(), z.unknown()),
  raw_ref: z.string().nullable(),
});

export type EventEnvelope = z.infer<typeof eventEnvelopeSchema>;
