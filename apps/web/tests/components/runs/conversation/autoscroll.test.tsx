// @vitest-environment happy-dom
import type {
  CreateRunContributionRequest,
  EventEnvelope,
  RunContributionContract,
  RunDetail,
  RunState,
  RuntimeDescriptor,
  ResolvedAgentConfig,
} from "@otomat/domain";
import { ConversationThread } from "@web/components/runs/conversation/thread";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { contribution } from "#support/contribution";
import { setTextareaValue } from "#support/dom-events";
import { envelope } from "#support/envelope";
import { eventStream } from "#support/event-stream";
import { stubResizeObserver, type ResizeObserverStub } from "#support/resize-observer";
import { controlScroll, type ScrollControl } from "#support/scroll-control";

const VIEWPORT_HEIGHT = 400;
const CONTENT_HEIGHT = 2000;

const mutate = vi.fn(
  (_request: CreateRunContributionRequest, callbacks?: { onSuccess?: () => void }) =>
    callbacks?.onSuccess?.(),
);
let contributions: RunContributionContract[] = [];
let contributionsPending = false;
let reducedMotion = false;

const CONFIG: ResolvedAgentConfig = {
  runtime: "claude",
  profile_id: "profile-1",
  profile_name: "Implementer",
  options: {},
  model: { id: "claude-opus", source: "manual" },
  guidance: null,
  skills: [],
  sources: { runtime: "profile", model: "profile", options: {} },
  config_hash: "config-1",
};

vi.mock("@web/api/runs/queries", () => ({
  useRunContributions: () => ({
    isPending: contributionsPending,
    isError: false,
    data: { contributions },
    refetch: vi.fn(),
  }),
}));

vi.mock("@web/api/runs/mutations", () => ({
  useCreateRunContribution: () => ({ mutate, isPending: false }),
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
      resume_model: { status: "supported" },
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
        steps: [
          {
            id: "s1",
            name: "Agent turn",
            agent: "claude",
            prompt: "p",
            depends_on: [],
            config: CONFIG,
          },
        ],
      },
      updated_at: "2026-07-25T10:00:00.000Z",
    },
    steps: [
      {
        id: "s1",
        run_id: runId,
        idx: 0,
        name: "Agent turn",
        status: status === "running" ? "running" : "succeeded",
        compete_group_id: null,
        worktree_id: null,
        branch: null,
        worktree_status: null,
        provider_wait: null,
        next_turn_config: null,
      },
    ],
    sessions: [
      {
        id: "as1",
        step_run_id: "s1",
        agent_id: "claude",
        status: "awaiting_input",
        provider_session_id: "ps-1",
        resumed_from_session_id: null,
        config: CONFIG,
        reported_model: null,
        started_at: "2026-07-25T10:00:00.000Z",
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
  mutate.mockClear();
});

function thread(detail: RunDetail, events: EventEnvelope[] = []) {
  return <ConversationThread detail={detail} stream={eventStream({ events })} stepRunId="s1" />;
}

async function renderThread(detail: RunDetail, events: EventEnvelope[] = []) {
  await act(async () => {
    root.render(thread(detail, events));
  });
}

function viewportElement(): HTMLElement {
  const content = container.querySelector<HTMLElement>('[aria-label="Run conversation"]');
  const viewport = content?.parentElement;
  if (!viewport) throw new Error("conversation viewport not rendered");
  return viewport;
}

async function attachScroll(): Promise<ScrollControl> {
  const scroll = controlScroll(viewportElement(), VIEWPORT_HEIGHT, CONTENT_HEIGHT);
  await act(async () => observers.resize());
  return scroll;
}

async function openThread(detail: RunDetail, events: EventEnvelope[] = []): Promise<ScrollControl> {
  await renderThread(detail, events);
  return attachScroll();
}

async function grow(scroll: ScrollControl, height: number) {
  await act(async () => {
    scroll.setContentHeight(height);
    observers.resize();
  });
}

async function prepend(scroll: ScrollControl, detail: RunDetail) {
  await act(async () => {
    scroll.setContentHeight(3200);
    root.render(thread(detail, [3, 4, 5, 6].map(logEvent)));
  });
  await act(async () => observers.resize());
}

function logEvent(seq: number): EventEnvelope {
  return envelope({ id: `e${seq}`, seq, step_run_id: "s1" });
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

    expect(mutate).toHaveBeenCalledWith(
      {
        step_run_id: "s1",
        target_agent_session_id: "as1",
        target_config_hash: "config-1",
        body: "please rebase",
      },
      expect.anything(),
    );
    expect(scroll.top()).toBe(scroll.maxTop());
    expect(viewportElement().contains(promptTextarea())).toBe(false);
  });

  it("holds the reader on the same rows when older activity is prepended", async () => {
    contributions = messages(12);
    const detail = runDetail("run-1", "awaiting_human");
    const scroll = await openThread(detail, [logEvent(5), logEvent(6)]);
    await act(async () => scroll.dragTo(600));
    const distance = scroll.maxTop() - scroll.top();

    await prepend(scroll, detail);

    expect(scroll.maxTop() - scroll.top()).toBe(distance);
    expect(scroll.top()).not.toBe(scroll.maxTop());
    expect(jumpButton()).not.toBeNull();
  });

  it("holds the reader on the same rows when the thread also grew below them", async () => {
    contributions = messages(12);
    const detail = runDetail("run-1", "awaiting_human");
    const scroll = await openThread(detail, [logEvent(5), logEvent(6)]);
    await act(async () => scroll.dragTo(600));
    await grow(scroll, 2600);
    const distance = scroll.maxTop() - scroll.top();

    await prepend(scroll, detail);

    expect(scroll.maxTop() - scroll.top()).toBe(distance);
  });

  it("stays on the newest item when older activity is prepended from the bottom", async () => {
    contributions = messages(12);
    const detail = runDetail("run-1", "awaiting_human");
    const scroll = await openThread(detail, [logEvent(5), logEvent(6)]);

    await prepend(scroll, detail);

    expect(scroll.top()).toBe(scroll.maxTop());
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
