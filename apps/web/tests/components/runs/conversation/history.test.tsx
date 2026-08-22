// @vitest-environment happy-dom
import type { RunContributionContract, RunDetail, RuntimeDescriptor } from "@otomat/domain";
import type { RunEventHistory } from "@web/api/runs/use-event-window-history";
import { ConversationThread } from "@web/components/runs/conversation/thread";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { contribution } from "#support/contribution";
import { findButton } from "#support/dom-queries";
import { envelope } from "#support/envelope";
import { eventHistory, eventStream } from "#support/event-stream";
import { stubIntersectionObserver, type IntersectionStub } from "#support/intersection";
import { mount } from "#support/mount";
import { stubResizeObserver, type ResizeObserverStub } from "#support/resize-observer";
import { controlScroll, type ScrollControl } from "#support/scroll-control";

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
  useRuntimes: () => ({ data: new Array<RuntimeDescriptor>() }),
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
      provider_wait: null,
    },
  ],
  sessions: [],
  compete_groups: [],
  worktree_path: null,
};

/** Taller than the window a first read loads, so the trigger stays on screen. */
const TALL_VIEWPORT = 900;

let intersections: IntersectionStub;
let resizes: ResizeObserverStub;

beforeEach(() => {
  intersections = stubIntersectionObserver();
  resizes = stubResizeObserver();
});

afterEach(() => {
  intersections.restore();
  resizes.restore();
});

async function attachScroll(container: HTMLElement, contentHeight: number): Promise<ScrollControl> {
  const content = container.querySelector<HTMLElement>('[aria-label="Run conversation"]');
  if (!content?.parentElement) throw new Error("conversation viewport not rendered");
  const scroll = controlScroll(content.parentElement, TALL_VIEWPORT, contentHeight);
  await act(async () => resizes.resize());
  return scroll;
}

function render(history: Partial<RunEventHistory>) {
  const events = [
    envelope({
      id: "e8",
      seq: 8,
      step_run_id: "s1",
      type: "run.contribution",
      payload: { contribution_id: "c1" },
    }),
    envelope({ id: "e9", seq: 9, step_run_id: "s1", payload: { text: "the newest line" } }),
  ];
  const stream = eventStream({
    events,
    history: eventHistory({ events, tailSeq: 9, ...history }),
  });
  return mount(<ConversationThread detail={detail} stream={stream} stepRunId="s1" />);
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

describe("conversation older-page trigger", () => {
  it("reads one window when a tall viewport keeps the trigger in view", async () => {
    const loadOlder = vi.fn();
    const { container, cleanup } = await render({ hasOlder: true, loadOlder });
    const scroll = await attachScroll(container, 320);
    expect(scroll.maxTop()).toBe(0);

    await act(async () => intersections.reveal());

    expect(loadOlder).not.toHaveBeenCalled();
    expect(findButton("Load earlier activity")).toBeDefined();
    await cleanup();
  });

  it("keeps following new activity at the bottom without paging", async () => {
    const loadOlder = vi.fn();
    const { container, cleanup } = await render({ hasOlder: true, loadOlder });
    const scroll = await attachScroll(container, 320);

    await act(async () => {
      scroll.setContentHeight(1400);
      resizes.resize();
    });
    await act(async () => intersections.reveal());

    expect(scroll.top()).toBe(scroll.maxTop());
    expect(loadOlder).not.toHaveBeenCalled();
    await cleanup();
  });

  it("loads the page above once the reader scrolls up to it", async () => {
    const loadOlder = vi.fn();
    const { container, cleanup } = await render({ hasOlder: true, loadOlder });
    const scroll = await attachScroll(container, 3000);
    expect(scroll.top()).toBe(scroll.maxTop());

    await act(async () => scroll.dragTo(0));
    await act(async () => intersections.reveal());

    expect(loadOlder).toHaveBeenCalledOnce();
    await cleanup();
  });
});
