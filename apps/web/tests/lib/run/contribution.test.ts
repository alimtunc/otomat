import type { RunDetail, RunState, RuntimeDescriptor } from "@otomat/domain";
import { queuedCount, resolveContributionGate } from "@web/lib/run/contribution";
import { expect, it } from "vitest";

import { contribution } from "#support/contribution";

function detail(status: RunState, providerSessionId: string | null = "ps-1"): RunDetail {
  return {
    run: {
      id: "run-1",
      issue_id: "i1",
      status,
      branch: "otomat/run/run-1",
      plan_json: {
        version: 1,
        steps: [{ id: "s1", name: "Agent turn", agent: "claude", prompt: "p", depends_on: [] }],
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
      },
    ],
    sessions: [
      {
        id: "as1",
        step_run_id: "s1",
        agent_id: "claude",
        status: "active",
        provider_session_id: providerSessionId,
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
    permissions: false,
    diff_hints: false,
  },
  availability: { status: "available", version: null },
};

it("promises the next safe turn while the agent is working, and names the step", () => {
  const gate = resolveContributionGate(detail("running", null), [CLAUDE], "online");
  expect(gate.stepRunId).toBe("s1");
  expect(gate.stepName).toBe("Agent turn");
  expect(gate.queues).toBe(true);
  expect(gate.note).toContain("next safe turn");
});

it("sends straight away on a resting run with a resumable session", () => {
  const gate = resolveContributionGate(detail("awaiting_human"), [CLAUDE], "online");
  expect(gate).toEqual({
    stepRunId: "s1",
    stepName: "Agent turn",
    queues: false,
    note: "Resumes this step's agent session as a new turn.",
  });
});

it("says the run is waiting for capacity rather than claiming the agent is working", () => {
  const gate = resolveContributionGate(detail("queued", null), [CLAUDE], "online");
  expect(gate.stepRunId).toBe("s1");
  expect(gate.queues).toBe(true);
  expect(gate.note).toContain("waiting for capacity");
});

it("keeps addressing the live step mid-turn, whose provider id only lands at settle", () => {
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
  );
  expect(gate.stepRunId).toBe("s2");
  expect(gate.stepName).toBe("Follow-up");
});

it("addresses an earlier resumable step when the furthest one has no provider session", () => {
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
  );
  expect(gate.stepRunId).toBe("s1");
  expect(gate.stepName).toBe("Agent turn");
});

it("refuses a resting run whose session has no provider id to resume", () => {
  const gate = resolveContributionGate(detail("awaiting_human", null), [CLAUDE], "online");
  expect(gate.stepRunId).toBeNull();
  expect(gate.note).toContain("No provider session");
});

it("refuses a terminal run", () => {
  const gate = resolveContributionGate(detail("completed"), [CLAUDE], "online");
  expect(gate.stepRunId).toBeNull();
  expect(gate.note).toContain("finished");
});

it("refuses while the daemon is offline", () => {
  const gate = resolveContributionGate(detail("running"), [CLAUDE], "offline");
  expect(gate.stepRunId).toBeNull();
  expect(gate.note).toContain("Daemon offline");
});

it("refuses a runtime that cannot resume or is unavailable", () => {
  const noResume = { ...CLAUDE, capabilities: { ...CLAUDE.capabilities, resume: false } };
  expect(resolveContributionGate(detail("running"), [noResume], "online").note).toContain(
    "does not support resuming",
  );

  const missing = { ...CLAUDE, availability: { status: "missing", version: null } as const };
  expect(resolveContributionGate(detail("running"), [missing], "online").note).toContain(
    "not available on this machine",
  );
});

it("says a runtime without steering cannot take a message once its session started", () => {
  const noSteering = {
    ...CLAUDE,
    capabilities: { ...CLAUDE.capabilities, steering: "unsupported" as const },
  };
  const gate = resolveContributionGate(detail("running"), [noSteering], "online");

  expect(gate.stepRunId).toBeNull();
  expect(gate.note).toContain("cannot take a message once a session has started");
});

it("accepts a message for a step that has not started, promising its first turn", () => {
  const pending: RunDetail = { ...detail("queued"), sessions: [] };
  const gate = resolveContributionGate(pending, [CLAUDE], "online");

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
    },
  ];
  runDetail.sessions = [
    {
      id: "loser-session",
      step_run_id: "loser",
      agent_id: "claude",
      status: "terminated",
      provider_session_id: "provider-loser",
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

  expect(resolveContributionGate(runDetail, [CLAUDE], "online").stepRunId).toBeNull();
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
    },
  ];
  runDetail.sessions = [
    {
      id: "winner-session",
      step_run_id: "winner",
      agent_id: "claude",
      status: "awaiting_input",
      provider_session_id: "provider-winner",
    },
    {
      id: "loser-session",
      step_run_id: "loser",
      agent_id: "unregistered-runtime",
      status: "terminated",
      provider_session_id: "provider-loser",
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

  expect(resolveContributionGate(runDetail, [CLAUDE], "online").stepRunId).toBe("winner");
});

it("counts only the messages still waiting", () => {
  expect(
    queuedCount([
      contribution({ id: "a", status: "queued" }),
      contribution({ id: "b", status: "delivered" }),
      contribution({ id: "c", status: "queued" }),
    ]),
  ).toBe(2);
});
