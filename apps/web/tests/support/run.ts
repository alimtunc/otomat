import type { RunContract } from "@otomat/domain";

export function runContract(overrides: Partial<RunContract> = {}): RunContract {
  return {
    id: "run-1",
    issue_id: "issue-1",
    status: "completed",
    branch: "otomat/run/one",
    plan_json: { version: 1, steps: [] },
    updated_at: "2026-07-20T10:00:00.000Z",
    ...overrides,
  };
}
