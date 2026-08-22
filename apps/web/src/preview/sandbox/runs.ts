import type {
  AgentSessionContract,
  EventEnvelope,
  RunCommitsResponse,
  RunContract,
  RunContributionsResponse,
  RunDetail,
  RunEventWindow,
  RunUsageResponse,
  StepRunContract,
  WorkspaceClosureSummary,
} from "@otomat/domain";
import { SANDBOX_NOW } from "@web/preview/sandbox/workspace";

export const SANDBOX_LIVE_RUN_ID = "sandbox-run-1";
export const SANDBOX_REVIEW_RUN_ID = "sandbox-run-2";

export function branchOf(runId: string): string {
  return `otomat/run/${runId.replace("sandbox-run-", "sandbox-")}`;
}

function run(id: string, issueId: string, status: RunContract["status"]): RunContract {
  return {
    id,
    issue_id: issueId,
    status,
    branch: branchOf(id),
    plan_json: {
      version: 1,
      steps: [
        { id: "node-implement", name: "Implement", agent: "claude", prompt: null, depends_on: [] },
        {
          id: "node-review",
          name: "Review",
          agent: "codex",
          prompt: null,
          depends_on: ["node-implement"],
        },
      ],
    },
    updated_at: SANDBOX_NOW,
  };
}

export const SANDBOX_RUNS: RunContract[] = [
  run(SANDBOX_LIVE_RUN_ID, "sandbox-issue-2", "running"),
  run(SANDBOX_REVIEW_RUN_ID, "sandbox-issue-3", "review_ready"),
];

function steps(runId: string, second: StepRunContract["status"]): StepRunContract[] {
  return [
    {
      id: `${runId}-step-1`,
      run_id: runId,
      idx: 0,
      name: "Implement",
      status: "succeeded",
      compete_group_id: null,
      worktree_id: "sandbox-worktree-1",
      branch: branchOf(runId),
      worktree_status: "active",
      provider_wait: null,
      next_turn_config: null,
    },
    {
      id: `${runId}-step-2`,
      run_id: runId,
      idx: 1,
      name: "Review",
      status: second,
      compete_group_id: null,
      worktree_id: "sandbox-worktree-1",
      branch: branchOf(runId),
      worktree_status: "active",
      provider_wait: null,
      next_turn_config: null,
    },
  ];
}

function session(runId: string, status: AgentSessionContract["status"]): AgentSessionContract {
  return {
    id: `${runId}-session-1`,
    step_run_id: `${runId}-step-2`,
    agent_id: "claude",
    status,
    provider_session_id: "sandbox-provider-session",
    resumed_from_session_id: null,
    config: null,
    reported_model: null,
    started_at: SANDBOX_NOW,
    boundary: {
      start_tree_sha: "3f1a9c0d5b7e2148ac6f0937d2be5148ac6f0937",
      start_head_sha: "1c4d7e9a2b6f08351d4e7a9c2b6f08351d4e7a9c",
      end_tree_sha: "8b2e5a1c9d3f47026b8e5a1c9d3f47026b8e5a1c",
      end_head_sha: "9f2c41d6b8ae5730c1d4f0a2b6e8d3c5a7091b24",
      error: null,
    },
  };
}

export function sandboxRunDetail(id: string): RunDetail | null {
  const found = SANDBOX_RUNS.find((candidate) => candidate.id === id);
  if (found === undefined) return null;
  const live = id === SANDBOX_LIVE_RUN_ID;
  return {
    run: found,
    steps: steps(id, live ? "running" : "succeeded"),
    sessions: [session(id, live ? "active" : "terminated")],
    compete_groups: [],
    worktree_path: `/sandbox/worktrees/${id}`,
    base_branch: "main",
    wait: null,
    resume: live
      ? { mode: "unavailable", reason: "A turn is already running." }
      : { mode: "native" },
    holds_workspace: true,
  };
}

function event(
  runId: string,
  seq: number,
  type: EventEnvelope["type"],
  payload: EventEnvelope["payload"],
): EventEnvelope {
  return {
    id: `${runId}-event-${String(seq)}`,
    run_id: runId,
    step_run_id: `${runId}-step-2`,
    agent_session_id: `${runId}-session-1`,
    seq,
    type,
    source: "claude",
    occurred_at: SANDBOX_NOW,
    payload,
    raw_ref: null,
  };
}

/** Replayed by the sandbox SSE stub in order, so a run page shows a real timeline without a daemon. */
export function sandboxRunEvents(runId: string): EventEnvelope[] {
  return [
    event(runId, 1, "run.lifecycle", { run_status: "running" }),
    event(runId, 2, "runtime.message", { text: "Reading the review comments." }),
    event(runId, 3, "runtime.tool_call", { tool: "read_file", path: "apps/web/src/router.ts" }),
    event(runId, 4, "runtime.message", { text: "Anchoring each comment to its diff sha." }),
    event(runId, 5, "git.diff_updated", { changed_files: 1 }),
  ];
}

export function sandboxEventWindow(runId: string): RunEventWindow {
  return { run_id: runId, events: sandboxRunEvents(runId), older_cursor: null };
}

export function sandboxRunUsage(runId: string): RunUsageResponse {
  return {
    run_id: runId,
    total: {
      availability: "final",
      input_tokens: 184_320,
      output_tokens: 21_004,
      cost_usd: 1.42,
      turns: 6,
    },
    steps: [
      {
        step_run_id: `${runId}-step-2`,
        name: "Review",
        status: "succeeded",
        usage: {
          availability: "final",
          input_tokens: 184_320,
          output_tokens: 21_004,
          cost_usd: 1.42,
          turns: 6,
        },
      },
    ],
  };
}

export function sandboxRunCommits(runId: string): RunCommitsResponse {
  return {
    run_id: runId,
    commits: [
      {
        sha: "9f2c41d6b8ae5730c1d4f0a2b6e8d3c5a7091b24",
        short_sha: "9f2c41d",
        subject: "feat(review): anchor comments to the diff sha",
        author_name: "Otomat",
        authored_at: "2026-08-19T09:12:00+02:00",
      },
    ],
    unavailable: null,
  };
}

export function sandboxRunContributions(runId: string): RunContributionsResponse {
  return { run_id: runId, contributions: [] };
}

export function sandboxRunWorkspace(runId: string): WorkspaceClosureSummary {
  return {
    run_id: runId,
    branch: branchOf(runId),
    base_branch: "main",
    worktree_path: `/sandbox/worktrees/${runId}`,
    commits: [
      {
        sha: "9f2c41d6b8ae5730c1d4f0a2b6e8d3c5a7091b24",
        subject: "feat(review): anchor comments to the diff sha",
      },
    ],
    commit_count: 1,
    uncommitted_files: 0,
    changed_files: 1,
    additions: 12,
    deletions: 3,
    blocker: null,
    pull_request: null,
  };
}
