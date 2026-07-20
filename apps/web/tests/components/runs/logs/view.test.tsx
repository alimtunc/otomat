// @vitest-environment happy-dom
import type { EventEnvelope, RunDetail } from "@otomat/domain";
import { RunLogsView } from "@web/components/runs/logs/view";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { envelope } from "#support/envelope";

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
    },
  ],
  sessions: [
    {
      id: "session-1",
      step_run_id: "s1",
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

vi.mock("@web/api/runs/run-events-provider", () => ({
  useRunEventStream: () => ({ events: streamEvents, state: "open", degraded: false }),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

async function renderView() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<RunLogsView />);
  });
  return {
    container,
    cleanup: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

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
