import { randomUUID } from "node:crypto";

import { eventEnvelopeSchema } from "@otomat/domain";
import { z } from "zod";

/**
 * Three rendering-fidelity tiers a runtime can attach to an emitted event, so
 * the UI can later be exercised at every level without a real provider:
 * - `raw_log`: verbatim stdout/stderr text, no structure.
 * - `parsed`: provider output normalized into an Otomat-typed event.
 * - `native`: a provider-native frame preserved as-is (highest fidelity).
 */
export const EVENT_FIDELITY = ["raw_log", "parsed", "native"] as const;
export const eventFidelitySchema = z.enum(EVENT_FIDELITY);
export type EventFidelity = (typeof EVENT_FIDELITY)[number];

/**
 * Every runtime event payload carries its fidelity tier and the emitting
 * adapter id. `test_adapter` marks data that must never be shown as a real
 * provider result. Extra keys pass through (tool args, usage numbers, frames).
 */
export const runtimeEventPayloadSchema = z.looseObject({
  fidelity: eventFidelitySchema,
  adapter: z.string(),
  test_adapter: z.boolean().optional(),
});

export type RuntimeEventPayload = z.infer<typeof runtimeEventPayloadSchema>;

/**
 * What a runtime pushes into the sink. It is the canonical Otomat event
 * envelope minus `seq`: the per-run sequence number is allocated downstream by
 * the OTO-7 ledger at persistence time, never by the runtime.
 */
export const runtimeEventSchema = eventEnvelopeSchema.omit({ seq: true }).extend({
  payload: runtimeEventPayloadSchema,
});

export type RuntimeEvent = z.infer<typeof runtimeEventSchema>;

export interface RuntimeEventInput {
  runId: string;
  /** Discriminator segment in the event id (`${runId}:${kind}:${uuid}`); usually the event type. */
  kind: string;
  type: RuntimeEvent["type"];
  source: RuntimeEvent["source"];
  /** Emitting adapter id, recorded on the payload alongside the fixed `parsed` fidelity. */
  adapter: string;
  occurredAt: string;
  stepRunId?: string | null;
  agentSessionId?: string | null;
  payload?: Record<string, unknown>;
}

/** Builds a control-plane `RuntimeEvent` envelope (the shared shape for review + supervisor markers). */
export function buildRuntimeEvent(input: RuntimeEventInput): RuntimeEvent {
  return {
    id: `${input.runId}:${input.kind}:${randomUUID()}`,
    run_id: input.runId,
    step_run_id: input.stepRunId ?? null,
    agent_session_id: input.agentSessionId ?? null,
    type: input.type,
    source: input.source,
    occurred_at: input.occurredAt,
    payload: { fidelity: "parsed", adapter: input.adapter, ...input.payload },
    raw_ref: null,
  };
}
