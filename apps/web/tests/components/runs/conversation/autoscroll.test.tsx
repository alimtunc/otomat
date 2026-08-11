// @vitest-environment happy-dom
import type {
  CreateRunContributionRequest,
  RunContributionContract,
  RunDetail,
  RunState,
  RuntimeDescriptor,
} from "@otomat/domain";
import { ConversationThread } from "@web/components/runs/conversation/thread";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { contribution } from "#support/contribution";
import { setTextareaValue } from "#support/dom-events";
import { stubResizeObserver, type ResizeObserverStub } from "#support/resize-observer";
import { controlScroll, type ScrollControl } from "#support/scroll-control";

const VIEWPORT_HEIGHT = 400;
const CONTENT_HEIGHT = 2000;

const mutateAsync = vi.fn(async (_request: CreateRunContributionRequest) => ({}));
let contributions: RunContributionContract[] = [];
let contributionsPending = false;
let reducedMotion = false;

vi.mock("@web/api/runs/queries", () => ({
  useRunContributions: () => ({
    isPending: contributionsPending,
    isError: false,
    data: { contributions },
    refetch: vi.fn(),
  }),
}));

vi.mock("@web/api/runs/mutations", () => ({
  useCreateRunContribution: () => ({ mutateAsync, isPending: false }),
  useRetryRunContribution: () => ({ mutate: vi.fn(), isPending: false }),
  useCancelRunContribution: () => ({ mutate: vi.fn(), isPending: false }),
  useDeliverRunContributions: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@web/api/daemon/queries", () => ({
  useDaemonStatus: () => ({ connectionState: "online" }),
  useRuntimes: () => ({ data: [claudeDescriptor()] }),
}));

vi.mock("@otomat/ui", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useMediaQuery: () => reducedMotion,
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function claudeDescriptor(): RuntimeDescriptor {
  return {
    id: "claude",
    display_name: "Claude Code",
    kind: "real",
    capabilities: {
      stream: true,
      steering: "turn_boundary",
      abort: true,
      resume: true,
      permissions: false,
      diff_hints: false,
    },
    availability: { status: "available", version: null },
    provider_options: [],
  };
}

function runDetail(runId: string, status: RunState): RunDetail {
  return {
    run: {
      id: runId,
      issue_id: "i1",
      status,
      branch: `otomat/run/${runId}`,
      plan_json: {
        version: 1,
        steps: [{ id: "s1", name: "Agent turn", agent: "claude", prompt: "p", depends_on: [] }],
      },
      updated_at: "2026-07-25T10:00:00.000Z",
    },
    steps: [
      {
        id: "s1",
        run_id: runId,
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
        provider_session_id: "ps-1",
      },
    ],
    compete_groups: [],
    worktree_path: null,
  };
}

function messages(count: number): RunContributionContract[] {
  const list: RunContributionContract[] = [];
  for (let index = 0; index < count; index += 1) {
    list.push(contribution({ id: `c${index}`, status: "acknowledged", body: `line ${index}` }));
  }
  return list;
}

let root: Root;
let container: HTMLDivElement;
let observers: ResizeObserverStub;

beforeEach(() => {
  observers = stubResizeObserver();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  observers.restore();
  contributions = [];
  contributionsPending = false;
  reducedMotion = false;
  mutateAsync.mockClear();
});

function thread(detail: RunDetail) {
  return <ConversationThread detail={detail} events={[]} state="open" degraded={false} />;
}

async function renderThread(detail: RunDetail) {
  await act(async () => {
    root.render(thread(detail));
  });
}

function viewportElement(): HTMLElement {
  const content = container.querySelector<HTMLElement>('[aria-label="Run conversation"]');
  const viewport = content?.parentElement;
  if (!viewport) throw new Error("conversation viewport not rendered");
  return viewport;
}

/** Gives the mounted viewport its geometry, then reports it as a first layout would. */
async function attachScroll(): Promise<ScrollControl> {
  const scroll = controlScroll(viewportElement(), VIEWPORT_HEIGHT, CONTENT_HEIGHT);
  await act(async () => observers.resize());
  return scroll;
}

async function openThread(detail: RunDetail): Promise<ScrollControl> {
  await renderThread(detail);
  return attachScroll();
}

async function grow(scroll: ScrollControl, height: number) {
  await act(async () => {
    scroll.setContentHeight(height);
    observers.resize();
  });
}

function jumpButton(): HTMLButtonElement | null {
  const buttons = [...container.querySelectorAll("button")];
  return buttons.find((button) => button.textContent?.includes("Jump to latest")) ?? null;
}

function promptTextarea(): HTMLTextAreaElement {
  const textarea = container.querySelector<HTMLTextAreaElement>(
    "textarea[aria-label='Run message']",
  );
  if (!textarea) throw new Error("run message textarea not found");
  return textarea;
}

describe("run conversation autoscroll", () => {
  it("opens a long conversation on its last message", async () => {
    contributions = messages(12);
    const scroll = await openThread(runDetail("run-1", "awaiting_human"));

    expect(scroll.top()).toBe(scroll.maxTop());
    expect(jumpButton()).toBeNull();
  });

  it("waits for the conversation to load, then opens on its last message", async () => {
    contributionsPending = true;
    await renderThread(runDetail("run-1", "awaiting_human"));
    expect(container.querySelector('[aria-label="Run conversation"]')).toBeNull();

    contributionsPending = false;
    contributions = messages(12);
    await renderThread(runDetail("run-1", "awaiting_human"));
    const scroll = await attachScroll();

    expect(scroll.top()).toBe(scroll.maxTop());
  });

  it("follows live growth while the reader sits at the bottom", async () => {
    contributions = messages(12);
    const scroll = await openThread(runDetail("run-1", "awaiting_human"));

    await grow(scroll, 3200);

    expect(scroll.top()).toBe(3200 - VIEWPORT_HEIGHT);
    expect(jumpButton()).toBeNull();
  });

  it("keeps the Working row in view while the agent streams", async () => {
    contributions = messages(6);
    const scroll = await openThread(runDetail("run-1", "running"));
    expect(container.textContent).toContain("Agent is working");

    await grow(scroll, 2600);

    expect(scroll.top()).toBe(2600 - VIEWPORT_HEIGHT);
  });

  it("holds the last item when the queued banner takes viewport height", async () => {
    contributions = [...messages(6), contribution({ id: "c-queued", status: "queued" })];
    const scroll = await openThread(runDetail("run-1", "awaiting_human"));
    expect(container.textContent).toContain("1 message is");

    await act(async () => {
      scroll.setViewportHeight(320);
      observers.resize();
    });

    expect(scroll.top()).toBe(CONTENT_HEIGHT - 320);
  });

  it("stops following once the reader scrolls up, and offers a jump", async () => {
    contributions = messages(12);
    const scroll = await openThread(runDetail("run-1", "awaiting_human"));

    await act(async () => scroll.dragTo(600));
    const button = jumpButton();
    expect(button).not.toBeNull();
    expect(button?.tagName).toBe("BUTTON");
    expect(button?.textContent).toContain("Jump to latest");

    await grow(scroll, 3200);

    expect(scroll.top()).toBe(600);
  });

  it("still follows from within the slack under the last message", async () => {
    contributions = messages(12);
    const scroll = await openThread(runDetail("run-1", "awaiting_human"));

    await act(async () => scroll.dragTo(scroll.maxTop() - 40));
    expect(jumpButton()).toBeNull();

    await grow(scroll, 3200);

    expect(scroll.top()).toBe(3200 - VIEWPORT_HEIGHT);
  });

  it("resumes following when the reader scrolls back to the bottom", async () => {
    contributions = messages(12);
    const scroll = await openThread(runDetail("run-1", "awaiting_human"));
    await act(async () => scroll.dragTo(600));
    expect(jumpButton()).not.toBeNull();

    await act(async () => scroll.dragTo(scroll.maxTop()));
    expect(jumpButton()).toBeNull();

    await grow(scroll, 3200);

    expect(scroll.top()).toBe(3200 - VIEWPORT_HEIGHT);
  });

  it("takes keyboard focus on the jump control", async () => {
    contributions = messages(12);
    const scroll = await openThread(runDetail("run-1", "awaiting_human"));
    await act(async () => scroll.dragTo(600));

    const button = jumpButton();
    button?.focus();

    expect(document.activeElement).toBe(button);
    expect(button?.disabled).toBe(false);
  });

  it("returns to the newest item and resumes following when the jump is used", async () => {
    contributions = messages(12);
    const scroll = await openThread(runDetail("run-1", "awaiting_human"));
    await act(async () => scroll.dragTo(600));

    const button = jumpButton();
    if (button === null) throw new Error("jump control not rendered");
    await act(async () => button.click());

    expect(scroll.top()).toBe(scroll.maxTop());
    expect(scroll.lastBehavior()).toBe("smooth");
    expect(jumpButton()).toBeNull();

    await grow(scroll, 3200);

    expect(scroll.top()).toBe(3200 - VIEWPORT_HEIGHT);
  });

  it("jumps without animation when the reader prefers reduced motion", async () => {
    reducedMotion = true;
    contributions = messages(12);
    const scroll = await openThread(runDetail("run-1", "awaiting_human"));
    await act(async () => scroll.dragTo(600));

    const button = jumpButton();
    if (button === null) throw new Error("jump control not rendered");
    await act(async () => button.click());

    expect(scroll.lastBehavior()).toBe("auto");
    expect(scroll.top()).toBe(scroll.maxTop());
  });

  it("brings a sent message into view even after the reader scrolled up", async () => {
    contributions = messages(12);
    const scroll = await openThread(runDetail("run-1", "awaiting_human"));
    await act(async () => scroll.dragTo(200));
    expect(jumpButton()).not.toBeNull();

    await act(async () => setTextareaValue(promptTextarea(), "please rebase"));
    await act(async () => {
      promptTextarea().dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", metaKey: true, bubbles: true }),
      );
    });

    expect(mutateAsync).toHaveBeenCalledWith({ step_run_id: "s1", body: "please rebase" });
    expect(scroll.top()).toBe(scroll.maxTop());
    expect(viewportElement().contains(promptTextarea())).toBe(false);
  });

  it("re-pins and reopens at the bottom when another run is shown", async () => {
    contributions = messages(12);
    const scroll = await openThread(runDetail("run-1", "awaiting_human"));
    await act(async () => scroll.dragTo(600));
    expect(jumpButton()).not.toBeNull();

    await renderThread(runDetail("run-2", "awaiting_human"));

    expect(scroll.top()).toBe(scroll.maxTop());
    expect(jumpButton()).toBeNull();
  });
});
