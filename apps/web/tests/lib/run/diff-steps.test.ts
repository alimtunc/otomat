import type {
  AgentSessionContract,
  RunDetail,
  SessionPassBoundary,
  StepRunContract,
} from "@otomat/domain";
import { runDiffSteps } from "@web/lib/run/diff-steps";
import { expect, it } from "vitest";

function step(id: string, idx: number, name: string): StepRunContract {
  return {
    id,
    run_id: "run-1",
    idx,
    name,
    status: "succeeded",
    compete_group_id: null,
    worktree_id: null,
    branch: null,
    worktree_status: null,
    provider_wait: null,
    next_turn_config: null,
  };
}

function session(id: string, stepRunId: string, boundary: Partial<SessionPassBoundary>) {
  return {
    id,
    step_run_id: stepRunId,
    agent_id: null,
    status: "terminated",
    provider_session_id: null,
    resumed_from_session_id: null,
    config: null,
    reported_model: null,
    started_at: null,
    boundary: {
      start_tree_sha: null,
      start_head_sha: null,
      end_tree_sha: null,
      end_head_sha: null,
      error: null,
      ...boundary,
    },
  } satisfies AgentSessionContract;
}

function detail(steps: StepRunContract[], sessions: AgentSessionContract[]): RunDetail {
  return {
    run: {
      id: "run-1",
      issue_id: "issue-1",
      status: "review_ready",
      branch: "otomat/run/run-1",
      plan_json: { version: 1, steps: [] },
      updated_at: "2026-08-22T10:00:00.000Z",
    },
    steps,
    sessions,
    compete_groups: [],
    worktree_path: "/tmp/wt",
    base_branch: "main",
    wait: null,
    resume: { mode: "native" },
    holds_workspace: true,
  };
}

it("numbers a step by its plan position, so a name planned twice still reads apart", () => {
  const listed = runDiffSteps(
    detail(
      [step("s1", 0, "Implement"), step("s2", 1, "Implement")],
      [
        session("p1", "s1", { start_tree_sha: "a", end_tree_sha: "b" }),
        session("p2", "s2", { start_tree_sha: "b", end_tree_sha: "c" }),
      ],
    ),
  );

  expect(listed).toEqual([
    { id: "s1", name: "Implement", number: 1, reconstructable: true },
    { id: "s2", name: "Implement", number: 2, reconstructable: true },
  ]);
});

it("keeps a resumed step selectable once its last turn has left a snapshot", () => {
  const listed = runDiffSteps(
    detail(
      [step("s1", 0, "Implement")],
      [
        session("p1", "s1", { start_tree_sha: "a", end_tree_sha: "b" }),
        session("p2", "s1", { start_tree_sha: "b", end_tree_sha: "c" }),
      ],
    ),
  );

  expect(listed[0]?.reconstructable).toBe(true);
});

it("marks a step whose last turn left no snapshot as having nothing to show", () => {
  const listed = runDiffSteps(
    detail(
      [step("s1", 0, "Implement"), step("s2", 1, "Review")],
      [
        session("p1", "s1", { start_tree_sha: "a", end_tree_sha: "b" }),
        session("p2", "s1", { start_tree_sha: "b" }),
      ],
    ),
  );

  expect(listed.map((entry) => entry.reconstructable)).toEqual([false, false]);
});
