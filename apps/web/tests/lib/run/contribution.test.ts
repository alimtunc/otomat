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
      plan_json: { version: 1, steps: [] },
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
    send_message: true,
    abort: true,
    resume: true,
    permissions: false,
    diff_hints: false,
  },
  availability: { status: "available", version: null },
};

it("queues rather than refuses while the agent is working, even before a provider session exists", () => {
  const gate = resolveContributionGate(detail("running", null), [CLAUDE], "online");
  expect(gate.enabled).toBe(true);
  expect(gate.queues).toBe(true);
  expect(gate.note).toContain("queued");
});

it("sends straight away on a resting run with a resumable session", () => {
  const gate = resolveContributionGate(detail("awaiting_human"), [CLAUDE], "online");
  expect(gate).toEqual({
    enabled: true,
    queues: false,
    note: "Resumes the same agent session as a new turn on this run.",
  });
});

it("refuses a resting run whose session has no provider id to resume", () => {
  const gate = resolveContributionGate(detail("review_ready", null), [CLAUDE], "online");
  expect(gate.enabled).toBe(false);
  expect(gate.note).toContain("No provider session");
});

it("refuses a terminal run", () => {
  const gate = resolveContributionGate(detail("completed"), [CLAUDE], "online");
  expect(gate.enabled).toBe(false);
  expect(gate.note).toContain("finished");
});

it("refuses while the daemon is offline", () => {
  const gate = resolveContributionGate(detail("running"), [CLAUDE], "offline");
  expect(gate.enabled).toBe(false);
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

it("refuses a run that has not started an agent session yet", () => {
  const pending = { ...detail("queued"), sessions: [] };
  expect(resolveContributionGate(pending, [CLAUDE], "online").note).toContain(
    "has not started an agent session",
  );
});

it("resolves the runtime from the selected competitor, not from a later losing session", () => {
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
      status: "completed",
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

  expect(resolveContributionGate(runDetail, [CLAUDE], "online").enabled).toBe(true);
});

it("counts only the messages still waiting", () => {
  expect(
    queuedCount([
      contribution({ id: "a", status: "queued" }),
      contribution({ id: "b", status: "sent" }),
      contribution({ id: "c", status: "queued" }),
    ]),
  ).toBe(2);
});
