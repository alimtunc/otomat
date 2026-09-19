import type { RunContract, RunDetail, StepRunContract, StepRunState } from "@otomat/domain";

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

export function stepRunContract(
  overrides: Partial<StepRunContract> & Pick<StepRunContract, "id">,
): StepRunContract {
  return {
    run_id: "run-1",
    idx: 0,
    name: `Step ${overrides.id}`,
    status: "succeeded",
    compete_group_id: null,
    worktree_id: null,
    branch: null,
    worktree_status: null,
    provider_wait: null,
    next_turn_config: null,
    ...overrides,
  };
}

const CHAIN = [
  { id: "implement", depends_on: [] },
  { id: "review", depends_on: ["implement"] },
  { id: "polish", depends_on: ["review"] },
];

/** implement → review → polish on a resting run; a step left out of `statuses` is still queued. */
export function chainRunDetail(statuses: Record<string, StepRunState>): RunDetail {
  return {
    run: runContract({
      status: "review_ready",
      plan_json: {
        version: 1,
        steps: CHAIN.map(({ id, depends_on }) => ({
          id,
          name: `Step ${id}`,
          agent: null,
          prompt: null,
          depends_on,
        })),
      },
    }),
    steps: CHAIN.map(({ id }, idx) =>
      stepRunContract({ id, idx, status: statuses[id] ?? "queued" }),
    ),
    sessions: [],
    compete_groups: [],
    worktree_path: null,
  };
}
