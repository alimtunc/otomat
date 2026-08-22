// @vitest-environment happy-dom
import type { RunDetail } from "@otomat/domain";
import { RunConversationView } from "@web/components/runs/conversation/view";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";

import type { FakeQueryState } from "#support/fake-query";
import { mount } from "#support/mount";

vi.mock("@otomat/ui", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useMediaQuery: () => true,
}));

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ runId: "run-1" }),
  useSearch: () => ({ step: null }),
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children?: ReactNode }) => <a>{children}</a>,
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
  sessions: [],
  compete_groups: [],
  worktree_path: null,
  wait: null,
};

let detailQuery: FakeQueryState = {};

vi.mock("@web/api/runs/queries", () => ({
  useRunDetail: () => detailQuery,
  useRunWorkspace: () => ({ data: undefined, isPending: true, isError: false, refetch: vi.fn() }),
  useRunUsage: () => ({ data: undefined }),
}));

vi.mock("@web/api/workspaces/queries", () => ({
  useWorkspacesForRun: () => ({ data: undefined }),
}));

vi.mock("@web/api/issues/queries", () => ({
  useIssue: () => ({ isPending: false, isError: false, data: undefined }),
}));

vi.mock("@web/api/runs/run-event-stream", () => ({
  useRunEventStream: () => ({ events: [], state: "open", degraded: false }),
}));

vi.mock("@web/api/runs/mutations", () => ({
  useAbortRun: () => ({ mutate: () => {}, isPending: false }),
  useResumeRun: () => ({ mutate: () => {}, isPending: false }),
  useAbandonWorkspace: () => ({ mutate: () => {}, isPending: false }),
}));

vi.mock("@web/components/runs/conversation/step-thread", () => ({
  StepConversationThread: () => <div data-testid="conversation" />,
}));

vi.mock("@web/components/runs/conversation/header", () => ({
  ConversationHeader: () => null,
}));

vi.mock("@web/components/runs/compete/comparison", () => ({
  CompeteComparison: () => <div data-testid="compete" />,
}));

vi.mock("@web/components/diagnostics/error-report", () => ({
  ErrorReport: ({ context }: { context?: string }) => <div>{context}</div>,
}));

it("keeps the loaded conversation on screen when a refresh fails", async () => {
  detailQuery = {
    isPending: false,
    isError: true,
    data: detail,
    dataUpdatedAt: Date.now(),
    isFetching: false,
    refetch: vi.fn(),
    error: new Error("refresh failed"),
  };

  const { container, cleanup } = await mount(<RunConversationView />);

  expect(container.textContent).toContain("Couldn’t refresh");
  expect(container.querySelector('[data-testid="conversation"]')).not.toBeNull();
  expect(container.textContent).not.toContain("Couldn’t load this run");
  await cleanup();
});

it("blocks on the error report only when no run detail was ever loaded", async () => {
  detailQuery = {
    isPending: false,
    isError: true,
    data: undefined,
    refetch: vi.fn(),
    error: new Error("daemon down"),
  };

  const { container, cleanup } = await mount(<RunConversationView />);

  expect(container.textContent).toContain("Couldn’t load this run");
  expect(container.querySelector('[data-testid="conversation"]')).toBeNull();
  await cleanup();
});
