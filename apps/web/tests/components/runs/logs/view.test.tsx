// @vitest-environment happy-dom
import {
  agentSessionContractSchema,
  resolvedAgentConfigSchema,
  type EventEnvelope,
  type RunDetail,
} from "@otomat/domain";
import { SessionRow } from "@web/components/runs/logs/session-row";
import { RunLogsView } from "@web/components/runs/logs/view";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import { envelope } from "#support/envelope";
import { eventStream } from "#support/event-stream";
import { mount } from "#support/mount";

let streamEvents: EventEnvelope[] = [];

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ runId: "run-1" }),
}));

const detail: RunDetail = {
  run: {
    id: "run-1",
    issue_id: "issue-1",
    status: "running",
    branch: "otomat/run-1",
    plan_json: {
      version: 1,
      steps: [{ id: "s1", name: "Implement", agent: null, prompt: null, depends_on: [] }],
    },
  },
  steps: [
    {
      id: "s1",
      run_id: "run-1",
      idx: 0,
      name: "Implement",
      status: "running",
      compete_group_id: null,
      worktree_id: null,
      branch: null,
      worktree_status: null,
      provider_wait: null,
    },
  ],
  sessions: [
    {
      id: "session-1",
      step_run_id: "s1",
      kind: "step" as const,
      agent_id: "claude",
      status: "active",
      provider_session_id: "prov-123",
    },
  ],
  compete_groups: [],
  worktree_path: null,
};

vi.mock("@web/api/runs/queries", () => ({
  useRunDetail: () => ({ isPending: false, isError: false, data: detail }),
}));

vi.mock("@web/api/runs/run-event-stream", () => ({
  useRunEventStream: () => eventStream({ events: streamEvents }),
}));

const renderView = () => mount(<RunLogsView />);

describe("RunLogsView", () => {
  it("shows sessions and an honest empty state before any event", async () => {
    streamEvents = [];
    const { container, cleanup } = await renderView();
    expect(container.textContent).toContain("claude");
    expect(container.textContent).toContain("prov-123");
    expect(container.textContent).toContain("Waiting to start");
    await cleanup();
  });

  it("lists persisted events and narrows by the error filter", async () => {
    streamEvents = [
      envelope({ seq: 1, type: "runtime.message", source: "claude", payload: { text: "hello" } }),
      envelope({
        seq: 2,
        type: "runtime.tool_call",
        source: "claude",
        payload: { tool: "Bash", is_error: true },
      }),
      envelope({ seq: 3, type: "runtime.usage", source: "claude", payload: {} }),
    ];
    const { container, cleanup } = await renderView();

    const list = container.querySelector('[aria-label="Run logs"]');
    expect(list).not.toBeNull();
    expect(list?.textContent).toContain("hello");
    expect(list?.textContent).toContain("tool · Bash");
    expect(list?.textContent).toContain("seq 3");

    const errorPill = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.startsWith("Errors"),
    );
    if (errorPill === undefined) throw new Error("no Errors filter pill rendered");
    await act(async () => {
      errorPill.click();
    });

    const filtered = container.querySelector('[aria-label="Run logs"]');
    expect(filtered?.textContent).toContain("tool · Bash");
    expect(filtered?.textContent).not.toContain("hello");
    await cleanup();
  });
});

it("separates requested Codex permissions from unreported effective permissions", async () => {
  const config = resolvedAgentConfigSchema.parse({
    runtime: "codex",
    profile_id: null,
    profile_name: null,
    options: { sandbox: "danger-full-access", approval_policy: "never" },
    guidance: null,
    skills: [],
    config_hash: "full",
  });
  const session = agentSessionContractSchema.parse({
    id: "codex-1",
    step_run_id: "s1",
    kind: "step" as const,
    agent_id: "codex",
    status: "terminated",
    provider_session_id: "thread-1",
    resumed_from_session_id: null,
    reported_model: null,
    started_at: null,
    boundary: {
      start_tree_sha: null,
      start_head_sha: null,
      end_tree_sha: null,
      end_head_sha: null,
      error: null,
    },
    config,
  });
  const { container, cleanup } = await mount(
    <SessionRow session={session} stepName="Implement" worktreePath="/work" />,
  );
  expect(container.textContent).toContain(
    "Requested permissions: sandbox danger-full-access · approval never",
  );
  expect(container.textContent).toContain("Effective permissions: not reported");
  expect(container.textContent).toContain("External resume loads its own configuration");
  expect(container.querySelector('button[aria-label="Copy Codex resume command"]')).not.toBeNull();
  await cleanup();
});
