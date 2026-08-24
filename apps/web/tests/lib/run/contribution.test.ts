import type { ResolvedAgentConfig, RunDetail, RunState, RuntimeDescriptor } from "@otomat/domain";
import { queuedCount, resolveContributionGate } from "@web/lib/run/contribution";
import { expect, it } from "vitest";

import { contribution } from "#support/contribution";

const CONFIG: ResolvedAgentConfig = {
  runtime: "claude",
  profile_id: "profile-1",
  profile_name: "Implementer",
  options: {},
  model: { id: "claude-opus", source: "manual" },
  guidance: null,
  skills: [],
  sources: { runtime: "profile", model: "profile", options: {} },
  config_hash: "config-1",
};

function detail(status: RunState, providerSessionId: string | null = "ps-1"): RunDetail {
  return {
    run: {
      id: "run-1",
      issue_id: "i1",
      status,
      branch: "otomat/run/run-1",
      plan_json: {
        version: 1,
        steps: [
          {
            id: "s1",
            name: "Agent turn",
            agent: "claude",
            prompt: "p",
            depends_on: [],
            config: CONFIG,
          },
        ],
      },
      updated_at: "2026-07-25T10:00:00.000Z",
    },
    steps: [
      {
        id: "s1",
        run_id: "run-1",
        idx: 0,
        name: "Agent turn",
        status: "running",
        compete_group_id: null,
        worktree_id: null,
        branch: null,
        worktree_status: null,
        provider_wait: null,
        next_turn_config: null,
      },
    ],
    sessions: [
      {
        id: "as1",
        step_run_id: "s1",
        agent_id: "claude",
        status: "active",
        provider_session_id: providerSessionId,
        resumed_from_session_id: null,
        config: CONFIG,
        reported_model: null,
        started_at: "2026-07-25T10:00:00.000Z",
        boundary: {
          start_tree_sha: null,
          start_head_sha: null,
          end_tree_sha: null,
          end_head_sha: null,
          error: null,
        },
      },
    ],
    compete_groups: [],
    worktree_path: null,
  };
}

const CLAUDE: RuntimeDescriptor = {
  id: "claude",
  display_name: "Claude Code",
  kind: "real",
  capabilities: {
    stream: true,
    steering: "turn_boundary",
    abort: true,
    resume: true,
    resume_model: { status: "supported" },
    interactions: { status: "unsupported", reason: "no channel" },
    diff_hints: false,
  },
  availability: { status: "available", version: null },
};

it("promises the next safe turn while the agent is working, and names the step", () => {
  const gate = resolveContributionGate(detail("running", null), [CLAUDE], "online", "s1");
  expect(gate.stepRunId).toBe("s1");
  expect(gate.stepName).toBe("Agent turn");
  expect(gate.queues).toBe(true);
  expect(gate.note).toContain("next safe turn");
});

it("sends straight away on a resting run with a resumable session", () => {
  const gate = resolveContributionGate(detail("awaiting_human"), [CLAUDE], "online", "s1");
  expect(gate).toEqual({
    stepRunId: "s1",
    stepName: "Agent turn",
    targetAgentSessionId: "as1",
    targetConfig: CONFIG,
    queues: false,
    note: "Resumes this step's agent session as a new turn.",
  });
});

it("says the run is waiting for capacity rather than claiming the agent is working", () => {
  const gate = resolveContributionGate(detail("queued", null), [CLAUDE], "online", "s1");
  expect(gate.stepRunId).toBe("s1");
  expect(gate.queues).toBe(true);
  expect(gate.note).toContain("waiting for capacity");
});

it("addresses exactly the selected step, never a sibling with more recent activity", () => {
  const base = detail("running");
  const [firstStep] = base.steps;
  const [firstSession] = base.sessions;
  if (!firstStep || !firstSession) throw new Error("fixture must seed one step and one session");
  const gate = resolveContributionGate(
    {
      ...base,
      steps: [firstStep, { ...firstStep, id: "s2", idx: 1, name: "Follow-up" }],
      sessions: [
        firstSession,
        { ...firstSession, id: "as2", step_run_id: "s2", provider_session_id: null },
      ],
    },
    [CLAUDE],
    "online",
    "s2",
  );
  expect(gate.stepRunId).toBe("s2");
  expect(gate.stepName).toBe("Follow-up");
});

it("refuses the selected step on a resting run when its own session has no provider id", () => {
  const base = detail("awaiting_human");
  const [firstStep] = base.steps;
  const [firstSession] = base.sessions;
  if (!firstStep || !firstSession) throw new Error("fixture must seed one step and one session");
  const gate = resolveContributionGate(
    {
      ...base,
      steps: [firstStep, { ...firstStep, id: "s2", idx: 1, name: "Follow-up" }],
      sessions: [
        firstSession,
        { ...firstSession, id: "as2", step_run_id: "s2", provider_session_id: null },
      ],
    },
    [CLAUDE],
    "online",
    "s2",
  );
  expect(gate.stepRunId).toBeNull();
  expect(gate.note).toContain("No provider session");
});

it("refuses a resting run whose session has no provider id to resume", () => {
  const gate = resolveContributionGate(detail("awaiting_human", null), [CLAUDE], "online", "s1");
  expect(gate.stepRunId).toBeNull();
  expect(gate.note).toContain("No provider session");
});

it("refuses a terminal run", () => {
  const gate = resolveContributionGate(detail("completed"), [CLAUDE], "online", "s1");
  expect(gate.stepRunId).toBeNull();
  expect(gate.note).toContain("finished");
});

it("refuses while the daemon is offline", () => {
  const gate = resolveContributionGate(detail("running"), [CLAUDE], "offline", "s1");
  expect(gate.stepRunId).toBeNull();
  expect(gate.note).toContain("Daemon offline");
});

it("refuses a runtime that cannot resume or is unavailable", () => {
  const noResume = { ...CLAUDE, capabilities: { ...CLAUDE.capabilities, resume: false } };
  expect(resolveContributionGate(detail("running"), [noResume], "online", "s1").note).toContain(
    "does not support resuming",
  );

  const missing = { ...CLAUDE, availability: { status: "missing", version: null } as const };
  expect(resolveContributionGate(detail("running"), [missing], "online", "s1").note).toContain(
    "not available on this machine",
  );
});

it("sends into the live session, rather than queueing, when the runtime steers live", () => {
  const live = { ...CLAUDE, capabilities: { ...CLAUDE.capabilities, steering: "live" as const } };
  const gate = resolveContributionGate(detail("running", null), [live], "online", "s1");

  expect(gate.stepRunId).toBe("s1");
  expect(gate.queues).toBe(false);
  expect(gate.note).toContain("live session");
});

it("says a runtime without steering cannot take a message once its session started", () => {
  const noSteering = {
    ...CLAUDE,
    capabilities: { ...CLAUDE.capabilities, steering: "unsupported" as const },
  };
  const gate = resolveContributionGate(detail("running"), [noSteering], "online", "s1");

  expect(gate.stepRunId).toBeNull();
  expect(gate.note).toContain("cannot take a message once a session has started");
});

it("accepts a message for a step that has not started, promising its first turn", () => {
  const pending: RunDetail = { ...detail("queued"), sessions: [] };
  const gate = resolveContributionGate(pending, [CLAUDE], "online", "s1");

  expect(gate.stepRunId).toBe("s1");
  expect(gate.queues).toBe(true);
  expect(gate.note).toContain("first turn");
});

it("refuses a run whose every step is a losing compete candidate", () => {
  const runDetail = detail("awaiting_human");
  runDetail.steps = [
    {
      id: "loser",
      run_id: "run-1",
      idx: 0,
      name: "Loser",
      status: "succeeded",
      compete_group_id: "group-1",
      worktree_id: null,
      branch: null,
      worktree_status: null,
      provider_wait: null,
      next_turn_config: null,
    },
  ];
  runDetail.sessions = [
    {
      id: "loser-session",
      step_run_id: "loser",
      agent_id: "claude",
      status: "terminated",
      provider_session_id: "provider-loser",
      resumed_from_session_id: null,
      config: CONFIG,
      reported_model: null,
      started_at: "2026-07-25T10:00:00.000Z",
      boundary: {
        start_tree_sha: null,
        start_head_sha: null,
        end_tree_sha: null,
        end_head_sha: null,
        error: null,
      },
    },
  ];
  runDetail.compete_groups = [
    {
      id: "group-1",
      run_id: "run-1",
      idx: 0,
      name: "Choose",
      status: "selected",
      winner_step_run_id: "winner",
      base_head_sha: "base",
    },
  ];

  const gate = resolveContributionGate(runDetail, [CLAUDE], "online", "loser");
  expect(gate.stepRunId).toBeNull();
  expect(gate.note).toContain("competitor was not selected");
});

it("routes to the selected competitor, never to a later losing session", () => {
  const runDetail = detail("awaiting_human");
  runDetail.steps = [
    {
      id: "winner",
      run_id: "run-1",
      idx: 0,
      name: "Winner",
      status: "succeeded",
      compete_group_id: "group-1",
      worktree_id: "worktree-winner",
      branch: "candidate/winner",
      worktree_status: "archived",
      provider_wait: null,
      next_turn_config: null,
    },
    {
      id: "loser",
      run_id: "run-1",
      idx: 1,
      name: "Loser",
      status: "succeeded",
      compete_group_id: "group-1",
      worktree_id: "worktree-loser",
      branch: "candidate/loser",
      worktree_status: "archived",
      provider_wait: null,
      next_turn_config: null,
    },
  ];
  runDetail.sessions = [
    {
      id: "winner-session",
      step_run_id: "winner",
      agent_id: "claude",
      status: "awaiting_input",
      provider_session_id: "provider-winner",
      resumed_from_session_id: null,
      config: CONFIG,
      reported_model: null,
      started_at: "2026-07-25T10:00:00.000Z",
      boundary: {
        start_tree_sha: null,
        start_head_sha: null,
        end_tree_sha: null,
        end_head_sha: null,
        error: null,
      },
    },
    {
      id: "loser-session",
      step_run_id: "loser",
      agent_id: "unregistered-runtime",
      status: "terminated",
      provider_session_id: "provider-loser",
      resumed_from_session_id: null,
      config: { ...CONFIG, runtime: "unregistered-runtime" },
      reported_model: null,
      started_at: "2026-07-25T10:00:00.000Z",
      boundary: {
        start_tree_sha: null,
        start_head_sha: null,
        end_tree_sha: null,
        end_head_sha: null,
        error: null,
      },
    },
  ];
  runDetail.compete_groups = [
    {
      id: "group-1",
      run_id: "run-1",
      idx: 0,
      name: "Choose",
      status: "selected",
      winner_step_run_id: "winner",
      base_head_sha: "base",
    },
  ];

  expect(resolveContributionGate(runDetail, [CLAUDE], "online", "winner").stepRunId).toBe("winner");
  expect(resolveContributionGate(runDetail, [CLAUDE], "online", "loser").note).toContain(
    "competitor was not selected",
  );
});

it("counts only the messages still waiting for a turn to start", () => {
  expect(
    queuedCount([
      contribution({ id: "a", status: "queued" }),
      contribution({ id: "b", status: "delivered" }),
      contribution({ id: "c", status: "queued" }),
      // Already claimed by the live turn: on its way, not waiting for the next one.
      contribution({ id: "d", status: "queued", agent_session_id: "as1" }),
    ]),
  ).toBe(2);
});
