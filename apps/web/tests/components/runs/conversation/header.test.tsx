// @vitest-environment happy-dom
import type { ResolvedAgentConfig, RunDetail, RuntimeDescriptor } from "@otomat/domain";
import { ConversationHeader } from "@web/components/runs/conversation/header";
import { afterEach, expect, it, vi } from "vitest";

import { mount } from "#support/mount";

const CURRENT: ResolvedAgentConfig = {
  runtime: "claude",
  profile_id: "profile-1",
  profile_name: "Implementer",
  model: { id: "claude-sonnet", source: "manual" },
  options: { effort: "high" },
  guidance: null,
  skills: [],
  sources: { runtime: "profile", model: "profile", options: { effort: "profile" } },
  config_hash: "current-hash",
};

const PENDING: ResolvedAgentConfig = {
  ...CURRENT,
  model: { id: "claude-opus", source: "manual" },
  options: { effort: "medium" },
  sources: { runtime: "profile", model: "turn", options: { effort: "turn" } },
  config_hash: "pending-hash",
};

let capability: RuntimeDescriptor["capabilities"]["resume_model"] = { status: "supported" };

const stopStep = vi.fn();

vi.mock("@web/api/runs/step-mutations", () => ({
  useStopRunStep: () => ({ mutate: stopStep, isPending: false }),
}));

vi.mock("@web/api/daemon/queries", () => ({
  useRuntimes: () => ({
    data: [
      {
        id: "claude",
        display_name: "Claude Code",
        kind: "real",
        capabilities: {
          stream: true,
          steering: "live",
          abort: true,
          resume: true,
          resume_model: capability,
          permissions: false,
          diff_hints: false,
          provider_limit: "deadline",
        },
        availability: { status: "available", version: null },
      } satisfies RuntimeDescriptor,
    ],
  }),
}));

vi.mock("@web/components/runs/conversation/next-turn-model-dialog", () => ({
  NextTurnModelDialog: ({ config }: { config: ResolvedAgentConfig }) => (
    <button type="button">Change {config.model?.id}</button>
  ),
}));

const DETAIL: RunDetail = {
  run: {
    id: "run-1",
    issue_id: "issue-1",
    status: "awaiting_human",
    branch: "otomat/run/run-1",
    plan_json: {
      version: 1,
      steps: [
        {
          id: "step-1",
          name: "Implement",
          agent: "claude",
          prompt: "work",
          depends_on: [],
          config: CURRENT,
        },
      ],
    },
    updated_at: "2026-08-21T00:00:00.000Z",
  },
  steps: [
    {
      id: "step-1",
      run_id: "run-1",
      idx: 0,
      name: "Implement",
      status: "awaiting_human",
      compete_group_id: null,
      worktree_id: null,
      branch: null,
      worktree_status: null,
      provider_wait: null,
      next_turn_config: PENDING,
    },
  ],
  sessions: [
    {
      id: "session-launched",
      step_run_id: "step-1",
      agent_id: "claude",
      status: "awaiting_input",
      provider_session_id: "provider-1",
      resumed_from_session_id: null,
      config: CURRENT,
      reported_model: "claude-sonnet-provider",
      started_at: "2026-08-21T00:00:00.000Z",
      boundary: {
        start_tree_sha: null,
        start_head_sha: null,
        end_tree_sha: null,
        end_head_sha: null,
        error: null,
      },
    },
    {
      id: "session-unlaunched",
      step_run_id: "step-1",
      agent_id: "claude",
      status: "created",
      provider_session_id: "provider-1",
      resumed_from_session_id: "session-launched",
      config: PENDING,
      reported_model: null,
      started_at: null,
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

afterEach(() => {
  capability = { status: "supported" };
  document.body.replaceChildren();
});

it("shows the last launched turn's reported model separately from the pending model", async () => {
  const view = await mount(<ConversationHeader detail={DETAIL} stepRunId="step-1" />);

  expect(view.container.textContent).toContain("claude-sonnet-provider · high");
  expect(view.container.textContent).toContain(
    "Requested: claude-sonnet · Reported: claude-sonnet-provider",
  );
  expect(view.container.textContent).toContain("Next turn: claude-opus");
  expect(view.container.textContent).toContain("Change claude-opus");
  await view.cleanup();
});

it("shows the installed runtime's refusal and the follow-up-step fallback", async () => {
  capability = { status: "unsupported", reason: "This version cannot resume with a model." };
  const view = await mount(<ConversationHeader detail={DETAIL} stepRunId="step-1" />);

  expect(view.container.textContent).toContain("Model change unavailable · Add follow-up step");
  expect(
    view.container.querySelector('[title="This version cannot resume with a model."]'),
  ).not.toBeNull();
  await view.cleanup();
});

it("offers Stop step only while the step's turn is live, wired to the step id", async () => {
  const idle = await mount(<ConversationHeader detail={DETAIL} stepRunId="step-1" />);
  expect(idle.container.textContent).not.toContain("Stop step");
  await idle.cleanup();

  const running: RunDetail = {
    ...DETAIL,
    run: { ...DETAIL.run, status: "running" },
    steps: [{ ...DETAIL.steps[0]!, status: "running" }],
  };
  const view = await mount(<ConversationHeader detail={running} stepRunId="step-1" />);
  const button = [...view.container.querySelectorAll("button")].find((candidate) =>
    candidate.textContent.includes("Stop step"),
  );
  if (!button) throw new Error("expected a Stop step action on a live step");
  button.click();
  expect(stopStep).toHaveBeenCalledWith("step-1");
  await view.cleanup();
});
