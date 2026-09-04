import type { RunInteractionContract } from "@otomat/domain";

export function interaction(
  overrides: Partial<RunInteractionContract> = {},
): RunInteractionContract {
  return {
    id: "e-ask",
    run_id: "run-1",
    step_run_id: "s1",
    agent_session_id: "sess-1",
    provider_request_id: "req-1",
    kind: "permission",
    state: "pending",
    prompt: "Run Write: notes.md",
    tool: "Write",
    reason: null,
    questions: [],
    answer: null,
    canceled_reason: null,
    requested_at: "2026-07-25T10:00:00.000Z",
    settled_at: null,
    ...overrides,
  };
}
