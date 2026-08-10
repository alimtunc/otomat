import { FAKE_RUNTIME_ID } from "@otomat/domain";

import type { RuntimeFinalState } from "#runtime/contract";
import type { RuntimeEvent } from "#runtime/events";

import type { EventSpec } from "./turn-specs.js";

export const FAKE_ADAPTER_ID = FAKE_RUNTIME_ID;

export interface TurnContext {
  run_id: string;
  step_run_id: string;
  agent_session_id: string;
  provider_session_id: string;
}

export function providerSessionId(agentSessionId: string): string {
  return `fake-session-${agentSessionId}`;
}

export function buildEvent(
  ctx: TurnContext,
  turn: number,
  index: number,
  spec: EventSpec,
  occurredAtMs: number,
  instanceId: string,
): RuntimeEvent {
  return {
    id: `${ctx.agent_session_id}:${instanceId}:${turn}:${index}`,
    run_id: ctx.run_id,
    step_run_id: ctx.step_run_id,
    agent_session_id: ctx.agent_session_id,
    type: spec.type,
    source: "otomat",
    occurred_at: new Date(occurredAtMs).toISOString(),
    payload: {
      fidelity: spec.fidelity,
      adapter: FAKE_ADAPTER_ID,
      test_adapter: true,
      ...spec.data,
    },
    raw_ref: null,
  };
}

export function canceledState(providerSession: string, emitted: number): RuntimeFinalState {
  return {
    status: "canceled",
    provider_session_id: providerSession,
    usage: null,
    error: null,
    event_count: emitted,
  };
}
