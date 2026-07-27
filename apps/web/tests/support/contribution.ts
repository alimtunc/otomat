import type { RunContributionContract } from "@otomat/domain";

export function contribution(
  overrides: Partial<RunContributionContract> = {},
): RunContributionContract {
  return {
    id: "c1",
    run_id: "run-1",
    seq: 0,
    body: "keep going",
    status: "queued",
    agent_session_id: null,
    delivered_at: null,
    settled_at: null,
    attempts: 0,
    error: null,
    created_at: "2026-07-25T10:00:00.000Z",
    ...overrides,
  };
}
