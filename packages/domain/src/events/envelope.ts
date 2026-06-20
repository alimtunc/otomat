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
  "step.lifecycle",
  "session.lifecycle",
  "runtime.log",
  "runtime.tool_call",
  "runtime.permission_request",
  "runtime.permission_response",
  "runtime.usage",
  "runtime.provider_session",
  "git.diff_updated",
  "review.comment_created",
  "review.comment_resolved",
  "pr.created",
  "pr.updated",
  "system.reconciled",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

/**
 * Canonical Otomat event envelope. `seq` is assigned per-run by the daemon at
 * persistence time (OTO-7 owns the ledger/seq allocator); OTO-5 only fixes the
 * shape so storage and contracts agree.
 */
export const eventEnvelopeSchema = z.object({
  id: z.string(),
  run_id: z.string(),
  step_run_id: z.string().nullable(),
  agent_session_id: z.string().nullable(),
  seq: z.number().int().nonnegative(),
  type: z.enum(EVENT_TYPES),
  source: z.enum(EVENT_SOURCES),
  occurred_at: z.iso.datetime(),
  payload: z.record(z.string(), z.unknown()),
  raw_ref: z.string().nullable(),
});

export type EventEnvelope = z.infer<typeof eventEnvelopeSchema>;
