// @vitest-environment happy-dom
import type { RunContributionContract, RunDetail, RuntimeDescriptor } from "@otomat/domain";
import type { RunEventHistory } from "@web/api/runs/use-event-history";
import { ConversationThread } from "@web/components/runs/conversation/thread";
import { describe, expect, it, vi } from "vitest";

import { contribution } from "#support/contribution";
import { findButton } from "#support/dom-queries";
import { envelope } from "#support/envelope";
import { eventHistory, eventStream } from "#support/event-stream";
import { mount } from "#support/mount";

const contributions: RunContributionContract[] = [
  contribution({ id: "c1", seq: 8, status: "acknowledged", body: "rebase please" }),
];

vi.mock("@web/api/runs/queries", () => ({
  useRunContributions: () => ({
    isPending: false,
    isError: false,
    data: { contributions },
    refetch: vi.fn(),
  }),
}));

vi.mock("@web/api/runs/mutations", () => ({
  useCreateRunContribution: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRetryRunContribution: () => ({ mutate: vi.fn(), isPending: false }),
  useCancelRunContribution: () => ({ mutate: vi.fn(), isPending: false }),
  useDeliverRunContributions: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@web/api/daemon/queries", () => ({
  useDaemonStatus: () => ({ connectionState: "online" }),
  useRuntimes: () => ({ data: [] as RuntimeDescriptor[] }),
}));

const detail: RunDetail = {
  run: {
    id: "run-1",
    issue_id: "i1",
    status: "awaiting_human",
    branch: "otomat/run-1",
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
  sessions: [],
  compete_groups: [],
  worktree_path: null,
};

function render(history: Partial<RunEventHistory>) {
  const events = [
    envelope({ id: "e8", seq: 8, type: "run.contribution", payload: { contribution_id: "c1" } }),
    envelope({ id: "e9", seq: 9, payload: { text: "the newest line" } }),
  ];
  const stream = eventStream({
    events,
    history: eventHistory({ events, tailSeq: 9, ...history }),
  });
  return mount(<ConversationThread detail={detail} stream={stream} />);
}

describe("conversation history window", () => {
  it("offers the page above the loaded window", async () => {
    const loadOlder = vi.fn();
    const { cleanup } = await render({ hasOlder: true, loadOlder });

    findButton("Load earlier activity")?.click();

    expect(loadOlder).toHaveBeenCalledOnce();
    await cleanup();
  });

  it("says nothing about earlier activity once the ledger start is loaded", async () => {
    const { container, cleanup } = await render({ hasOlder: false });
    expect(container.textContent).not.toContain("earlier activity");
    await cleanup();
  });

  it("keeps the loaded messages and offers a retry when a page above fails", async () => {
    const loadOlder = vi.fn();
    const { container, cleanup } = await render({
      hasOlder: true,
      olderFailed: true,
      loadOlder,
    });

    expect(container.textContent).toContain("Couldn’t load earlier activity.");
    expect(container.textContent).toContain("rebase please");

    findButton("Retry")?.click();

    expect(loadOlder).toHaveBeenCalledOnce();
    await cleanup();
  });

  it("reports a page above that is on its way", async () => {
    const { container, cleanup } = await render({ hasOlder: true, loadingOlder: true });
    expect(container.textContent).toContain("Loading earlier activity…");
    expect(findButton("Load earlier activity")).toBeUndefined();
    await cleanup();
  });

  it("waits for the first window instead of claiming the run has nothing", async () => {
    const { container, cleanup } = await render({ status: "pending" });
    expect(container.textContent).not.toContain("Nothing here yet");
    expect(container.querySelector('[aria-label="Run conversation"]')).toBeNull();
    await cleanup();
  });

  it("offers a retry when the first window itself fails", async () => {
    const retry = vi.fn();
    const { container, cleanup } = await render({ status: "error", retry });

    expect(container.textContent).toContain("Couldn’t load this conversation");
    findButton("Retry")?.click();

    expect(retry).toHaveBeenCalledOnce();
    await cleanup();
  });
});
