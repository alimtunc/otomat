// @vitest-environment happy-dom
import type { RunContributionContract, RunDetail } from "@otomat/domain";
import { ConversationSection } from "@web/components/issues/workspace/conversation-section";
import { RunConversationView } from "@web/components/runs/conversation/view";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { contribution } from "#support/contribution";
import { findLabelled } from "#support/dom-queries";
import { eventStream } from "#support/event-stream";
import { mountWithQuery, type Mounted } from "#support/mount";
import { stubResizeObserver, type ResizeObserverStub } from "#support/resize-observer";
import { controlScroll, type ScrollControl } from "#support/scroll-control";

const VIEWPORT_HEIGHT = 400;

let contributions: RunContributionContract[] = [];

const detail: RunDetail = {
  run: {
    id: "run-1",
    issue_id: "issue-1",
    status: "awaiting_human",
    branch: "otomat/run-1",
    plan_json: {
      version: 1,
      steps: [{ id: "s1", name: "Implement", agent: "claude", prompt: "p", depends_on: [] }],
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
      id: "as1",
      step_run_id: "s1",
      agent_id: "claude",
      status: "awaiting_input",
      provider_session_id: "ps-1",
    },
  ],
  compete_groups: [],
  worktree_path: null,
  base_branch: "main",
  wait: null,
  resume: { mode: "native" },
  holds_workspace: true,
};

vi.mock("@otomat/ui", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useMediaQuery: () => true,
}));

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ runId: "run-1" }),
  Link: ({ children }: { children?: unknown }) => <a>{children as never}</a>,
}));

vi.mock("@web/api/runs/queries", () => ({
  useRunDetail: () => ({ isPending: false, isError: false, data: detail, refetch: vi.fn() }),
  useRunContributions: () => ({
    isPending: false,
    isError: false,
    data: { contributions },
    refetch: vi.fn(),
  }),
  useRunWorkspace: () => ({ data: undefined, isPending: true, isError: false, refetch: vi.fn() }),
  useRunUsage: () => ({ data: undefined }),
  useSessionContext: () => ({ data: undefined, isPending: false, isError: false }),
}));

vi.mock("@web/api/issues/queries", () => ({
  useIssue: () => ({ isPending: false, isError: false, data: undefined }),
}));

vi.mock("@web/api/runs/run-event-stream", () => ({
  useRunEventStream: () => eventStream(),
}));

vi.mock("@web/api/runs/mutations", () => ({
  useAbortRun: () => ({ mutate: vi.fn(), isPending: false }),
  useResumeRun: () => ({ mutate: vi.fn(), isPending: false }),
  useAbandonWorkspace: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateRunContribution: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRetryRunContribution: () => ({ mutate: vi.fn(), isPending: false }),
  useCancelRunContribution: () => ({ mutate: vi.fn(), isPending: false }),
  useDeliverRunContributions: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@web/api/daemon/queries", () => ({
  useDaemonStatus: () => ({ connectionState: "online" }),
  useRuntimes: () => ({ data: [] }),
}));

let observers: ResizeObserverStub;

beforeEach(() => {
  observers = stubResizeObserver();
  contributions = [contribution({ id: "c1", status: "acknowledged", body: "rebase please" })];
});

afterEach(() => {
  observers.restore();
});

function composerForm(): HTMLFormElement {
  const form = document.body.querySelector<HTMLFormElement>("form[aria-label='Run message']");
  if (form === null) throw new Error("composer not rendered");
  return form;
}

function threadRoot(): HTMLElement {
  const parent = composerForm().parentElement;
  if (parent === null) throw new Error("thread root not rendered");
  return parent;
}

function messageViewport(): HTMLElement {
  const viewport = findLabelled("Run conversation")?.parentElement;
  if (!viewport) throw new Error("conversation viewport not rendered");
  return viewport;
}

function scrollersWithin(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>("*")].filter((element) =>
    /overflow-(y-)?(auto|scroll)/.test(element.className),
  );
}

/** A `relative` scroll container is the containing block its absolute descendants cannot escape. */
function isContainingBlock(element: HTMLElement): boolean {
  return /(^|\s)(relative|absolute|fixed|sticky)(\s|$)/.test(element.className);
}

function scrolledAncestors(from: HTMLElement): string[] {
  const moved: string[] = [];
  for (let element = from.parentElement; element !== null; element = element.parentElement) {
    if (element.scrollTop !== 0) moved.push(element.className);
  }
  return moved;
}

async function layOut(contentHeight: number): Promise<ScrollControl> {
  const scroll = controlScroll(messageViewport(), VIEWPORT_HEIGHT, contentHeight);
  await act(async () => observers.resize());
  return scroll;
}

function expectsSoleScroller(): HTMLElement {
  const viewport = messageViewport();
  expect(scrollersWithin(threadRoot())).toEqual([viewport]);
  expect(isContainingBlock(viewport)).toBe(true);
  expect(viewport.contains(composerForm())).toBe(false);
  return viewport;
}

describe.each([
  ["run cockpit", () => mountWithQuery(<RunConversationView />)],
  ["issue conversation embed", () => mountWithQuery(<ConversationSection runId="run-1" />)],
])("%s conversation scroll ownership", (_surface, render) => {
  let mounted: Mounted;

  afterEach(async () => {
    await mounted.cleanup();
  });

  it("keeps a window shorter than the viewport inside the sole conversation scroller", async () => {
    mounted = await render();
    const scroll = await layOut(240);

    expectsSoleScroller();
    expect(scroll.top()).toBe(0);
    expect(scrolledAncestors(messageViewport())).toEqual([]);
  });

  it("scrolls a window longer than the viewport without moving anything above it", async () => {
    mounted = await render();
    const scroll = await layOut(2000);

    const viewport = expectsSoleScroller();
    expect(scroll.top()).toBe(scroll.maxTop());
    expect(scrolledAncestors(viewport)).toEqual([]);

    await act(async () => {
      scroll.setContentHeight(3200);
      observers.resize();
    });

    expect(scroll.top()).toBe(3200 - VIEWPORT_HEIGHT);
    expect(scrolledAncestors(viewport)).toEqual([]);
  });
});
