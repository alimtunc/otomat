import type { RunDetail, StepRunContract } from "@otomat/domain";
import { providerWaitTarget } from "@web/lib/run/provider-wait";
import { expect, it } from "vitest";

const WAIT = {
  provider: "claude",
  reason: "Claude AI usage limit reached|4102444800",
  detected_at: "2026-08-19T12:00:00.000Z",
  provider_resume_at: "2100-01-01T00:00:00.000Z",
  resume_at: "2100-01-01T00:00:00.000Z",
};

function step(overrides: Partial<StepRunContract> & Pick<StepRunContract, "id">): StepRunContract {
  return {
    run_id: "run-1",
    idx: 0,
    name: "Implement",
    status: "succeeded",
    compete_group_id: null,
    worktree_id: null,
    branch: null,
    worktree_status: null,
    provider_wait: null,
    ...overrides,
  };
}

function detail(
  steps: StepRunContract[],
  status: RunDetail["run"]["status"] = "waiting_for_provider",
): RunDetail {
  return {
    run: {
      id: "run-1",
      issue_id: "issue-1",
      status,
      branch: "otomat/run/run-1",
      plan_json: { version: 1, steps: [] },
      updated_at: "2026-08-19T12:00:00.000Z",
    },
    steps,
    sessions: [],
    compete_groups: [],
    worktree_path: "/tmp/wt",
    base_branch: "main",
    wait: null,
    resume: { mode: "native" },
    holds_workspace: true,
  };
}

it("finds the suspended step among the run's finished ones", () => {
  const waiting = step({
    id: "step-2",
    idx: 1,
    status: "waiting_for_provider",
    provider_wait: WAIT,
  });

  expect(providerWaitTarget(detail([step({ id: "step-1" }), waiting]))).toEqual({
    step: waiting,
    wait: WAIT,
  });
});

it("answers null for a run with nothing suspended", () => {
  expect(providerWaitTarget(detail([step({ id: "step-1" })]))).toBeNull();
});

it("speaks for nothing once the run left the wait its step is still stamped with", () => {
  const waiting = step({
    id: "step-2",
    idx: 1,
    status: "waiting_for_provider",
    provider_wait: WAIT,
  });

  expect(providerWaitTarget(detail([waiting], "awaiting_selection"))).toBeNull();
});
