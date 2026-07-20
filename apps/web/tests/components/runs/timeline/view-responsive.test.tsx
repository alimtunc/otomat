// @vitest-environment happy-dom
import type { RunDetail } from "@otomat/domain";
import { RunTimelineView } from "@web/components/runs/timeline/view";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mount } from "#support/mount";

let wide = true;

vi.mock("@otomat/ui", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useMediaQuery: () => wide,
}));

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ runId: "run-1" }),
  Link: ({ children }: { children?: unknown }) => <a>{children as never}</a>,
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
  sessions: [],
  compete_groups: [],
  worktree_path: null,
};

vi.mock("@web/api/runs/queries", () => ({
  useRunDetail: () => ({ isPending: false, isError: false, data: detail }),
}));

vi.mock("@web/api/runs/run-events-provider", () => ({
  useRunEventStream: () => ({ events: [], state: "open", degraded: false }),
}));

vi.mock("@web/api/runs/mutations", () => ({
  useAbortRun: () => ({ mutate: () => {}, isPending: false }),
  useResumeRun: () => ({ mutate: () => {}, isPending: false }),
}));

vi.mock("@web/components/runs/timeline/list", () => ({
  RunTimeline: () => <div data-testid="timeline" />,
}));

vi.mock("@web/components/runs/cockpit/follow-up-composer", () => ({
  FollowUpComposer: () => <div data-testid="composer" />,
}));

vi.mock("@web/components/runs/compete/comparison", () => ({
  CompeteComparison: () => <div data-testid="compete" />,
}));

const renderView = () => mount(<RunTimelineView />);

afterEach(() => {
  wide = true;
});

describe("RunTimelineView responsive composition", () => {
  it("keeps the three-pane rails on wide viewports", async () => {
    wide = true;
    const { container, cleanup } = await renderView();
    expect(container.textContent).toContain("Steps & sessions");
    expect(container.textContent).toContain("Run context");
    expect(container.querySelector("[aria-expanded]")).toBeNull();
    await cleanup();
  });

  it("stacks a context strip and steps disclosure on narrow viewports", async () => {
    wide = false;
    const { container, cleanup } = await renderView();
    const disclosure = container.querySelector<HTMLButtonElement>("[aria-expanded]");
    if (disclosure === null) throw new Error("no steps disclosure rendered");
    expect(container.textContent).not.toContain("Run context");
    expect(container.textContent).toContain("otomat/run-1");
    expect(container.querySelector('[data-testid="timeline"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="composer"]')).not.toBeNull();

    await act(async () => {
      disclosure.click();
    });
    expect(container.textContent).toContain("Implement");
    await cleanup();
  });
});
