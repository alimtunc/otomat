import type { RunDetail, RunState, RuntimeDescriptor } from "@otomat/domain";
import { resolveFollowUpGate } from "@web/lib/follow-up";
import { describe, expect, it } from "vitest";

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
    },
    steps: [
      {
        id: "s1",
        run_id: "run-1",
        idx: 0,
        name: "Agent turn",
        status: "succeeded",
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
        status: "awaiting_input",
        provider_session_id: providerSessionId,
      },
    ],
    compete_groups: [],
    worktree_path: null,
  };
}

function descriptor(overrides: Partial<RuntimeDescriptor> = {}): RuntimeDescriptor {
  return {
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
    ...overrides,
  };
}

describe("resolveFollowUpGate", () => {
  it.each(["awaiting_human", "review_ready"] as const)("enables a resting %s run", (status) => {
    expect(resolveFollowUpGate(detail(status), [descriptor()], "online")).toEqual({
      enabled: true,
      reason: null,
    });
  });

  it("disables while the daemon is offline or reconnecting", () => {
    expect(resolveFollowUpGate(detail("awaiting_human"), [descriptor()], "offline").enabled).toBe(
      false,
    );
    expect(
      resolveFollowUpGate(detail("awaiting_human"), [descriptor()], "reconnecting").enabled,
    ).toBe(false);
  });

  it.each(["completed", "failed", "canceled"] as const)("disables a %s run", (status) => {
    const gate = resolveFollowUpGate(detail(status), [descriptor()], "online");
    expect(gate.enabled).toBe(false);
    expect(gate.reason).toContain("finished");
  });

  it.each(["running", "preparing", "queued", "awaiting_permission"] as const)(
    "disables an active %s run",
    (status) => {
      const gate = resolveFollowUpGate(detail(status), [descriptor()], "online");
      expect(gate.enabled).toBe(false);
      expect(gate.reason).toContain("working");
    },
  );

  it("disables a run with no provider session to resume", () => {
    const gate = resolveFollowUpGate(detail("awaiting_human", null), [descriptor()], "online");
    expect(gate.enabled).toBe(false);
    expect(gate.reason).toContain("session");
  });

  it("disables while the runtime catalog is still loading", () => {
    expect(resolveFollowUpGate(detail("awaiting_human"), undefined, "online").enabled).toBe(false);
  });

  it("disables when the run's runtime is unknown to the daemon", () => {
    const gate = resolveFollowUpGate(detail("awaiting_human"), [], "online");
    expect(gate.enabled).toBe(false);
    expect(gate.reason).toContain("runtime");
  });

  it("disables when the runtime cannot resume a session", () => {
    const incapable = descriptor({
      capabilities: {
        stream: true,
        send_message: false,
        abort: true,
        resume: false,
        permissions: false,
        diff_hints: false,
      },
    });
    const gate = resolveFollowUpGate(detail("awaiting_human"), [incapable], "online");
    expect(gate.enabled).toBe(false);
    expect(gate.reason).toContain("resum");
  });

  it("disables when the runtime binary is unavailable", () => {
    const unavailable = descriptor({
      availability: { status: "unavailable", reason: "binary_not_found" },
    });
    const gate = resolveFollowUpGate(detail("awaiting_human"), [unavailable], "online");
    expect(gate.enabled).toBe(false);
    expect(gate.reason).toContain("not available");
  });

  it("uses the selected competitor runtime instead of an earlier losing session", () => {
    const runDetail = detail("awaiting_human");
    runDetail.steps = [
      {
        id: "loser",
        run_id: "run-1",
        idx: 0,
        name: "Loser",
        status: "succeeded",
        compete_group_id: "group-1",
        worktree_id: "worktree-loser",
        branch: "candidate/loser",
        worktree_status: "archived",
      },
      {
        id: "winner",
        run_id: "run-1",
        idx: 1,
        name: "Winner",
        status: "succeeded",
        compete_group_id: "group-1",
        worktree_id: "worktree-winner",
        branch: "candidate/winner",
        worktree_status: "archived",
      },
    ];
    runDetail.sessions = [
      {
        id: "loser-session",
        step_run_id: "loser",
        agent_id: "missing-runtime",
        status: "completed",
        provider_session_id: "provider-loser",
      },
      {
        id: "winner-session",
        step_run_id: "winner",
        agent_id: "claude",
        status: "awaiting_input",
        provider_session_id: "provider-winner",
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

    expect(resolveFollowUpGate(runDetail, [descriptor()], "online")).toEqual({
      enabled: true,
      reason: null,
    });
  });
});
