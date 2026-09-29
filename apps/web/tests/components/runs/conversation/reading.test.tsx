// @vitest-environment happy-dom
import type { ConversationEntry, RunDetail } from "@otomat/domain";
import type { QueryClient } from "@tanstack/react-query";
import { ConversationThreadBody } from "@web/components/conversations/thread-body";
import { ConversationSection } from "@web/components/issues/workspace/conversation-section";
import { RunConversationView } from "@web/components/runs/conversation/view";
import { act, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { contribution } from "#support/contribution";
import { conversationEntry } from "#support/conversations";
import { findButton, findLabelled } from "#support/dom-queries";
import { eventHistory, eventStream } from "#support/event-stream";
import { mountWithQuery } from "#support/mount";
import { testQueryClient } from "#support/query";
import { stubResizeObserver, type ResizeObserverStub } from "#support/resize-observer";
import { runContract, stepRunContract } from "#support/run";
import { controlScroll } from "#support/scroll-control";

const T1 = "2026-09-19T10:00:00.000Z";
const T2 = "2026-09-19T10:05:00.000Z";

const mutate = vi.fn();
let entries: ConversationEntry[] = [];
let historyStatus: "pending" | "ready" = "ready";

const detail: RunDetail = {
  run: runContract({
    status: "awaiting_human",
    branch: "otomat/run-1",
    plan_json: {
      version: 1,
      steps: [
        { id: "s1", name: "Implement", agent: "claude", prompt: "p", depends_on: [] },
        { id: "s2", name: "Review", agent: "claude", prompt: "p", depends_on: ["s1"] },
      ],
    },
  }),
  steps: [
    stepRunContract({ id: "s1", name: "Implement", status: "running" }),
    stepRunContract({ id: "s2", idx: 1, name: "Review", status: "queued" }),
  ],
  sessions: [
    {
      id: "as1",
      step_run_id: "s1",
      kind: "step" as const,
      agent_id: "claude",
      status: "awaiting_input",
      provider_session_id: "ps-1",
    },
  ],
  compete_groups: [],
  worktree_path: null,
  base_branch: "main",
  wait: null,
  resume: { mode: "native", step_run_ids: [] },
  holds_workspace: true,
};

vi.mock("@otomat/ui", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useMediaQuery: () => true,
}));

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ runId: "run-1" }),
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => string }) =>
    select({ location: { pathname: "/runs/run-1" } }),
  useSearch: () => ({ step: "s1" }),
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children?: ReactNode }) => <a>{children}</a>,
}));

vi.mock("@web/api/conversations/queries", () => ({
  conversationsOptions: () => ({
    queryKey: ["conversations"],
    queryFn: () => ({ entries, observed_at: T1 }),
    staleTime: Infinity,
  }),
}));

vi.mock("@web/api/conversations/mutations", () => ({ useMarkConversations: () => ({ mutate }) }));

vi.mock("@web/api/runs/use-step-event-history", () => ({
  useStepEventHistory: () => eventHistory({ status: historyStatus }),
}));

vi.mock("@web/api/runs/queries", () => ({
  useRunInteractions: () => ({ data: { interactions: [] } }),
  useRunDetail: () => ({ isPending: false, isError: false, data: detail, refetch: vi.fn() }),
  useRunContributions: () => ({
    isPending: false,
    isError: false,
    data: { contributions: [contribution({ id: "c1", status: "acknowledged", body: "rebase" })] },
    refetch: vi.fn(),
  }),
  useRunWorkspace: () => ({ data: undefined, isPending: true, isError: false, refetch: vi.fn() }),
  useRunUsage: () => ({ data: undefined }),
  useSessionContext: () => ({ data: undefined, isPending: false, isError: false }),
}));

vi.mock("@web/api/workspaces/queries", () => ({
  useWorkspacesForRun: () => ({ data: undefined }),
}));

vi.mock("@web/api/prs/queries", () => ({ useRunPullRequest: () => ({ data: undefined }) }));

vi.mock("@web/api/issues/queries", () => ({
  useIssue: () => ({ isPending: false, isError: false, data: undefined }),
}));

vi.mock("@web/api/runs/run-event-stream", () => ({ useRunEventStream: () => eventStream() }));

vi.mock("@web/api/runs/step-mutations", () => ({
  useStopRunStep: () => ({ mutate: vi.fn(), isPending: false }),
  useCancelRunStep: () => ({ mutate: vi.fn(), isPending: false }),
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

vi.mock("@web/components/runs/conversation/next-turn/menu", () => ({ NextTurnMenu: () => null }));

const thread = (stepRunId: string, overrides: Partial<ConversationEntry> = {}) =>
  conversationEntry({ id: `conversation:${stepRunId}`, step_run_id: stepRunId, ...overrides });

const read = (stepRunId: string, at: string) => [
  {
    marks: [
      {
        entry_id: `conversation:${stepRunId}`,
        read: true,
        archived: false,
        evidence_updated_at: at,
      },
    ],
  },
];

const body = () => <ConversationThreadBody runId="run-1" stepRunId="s1" />;

const refresh = async (client: QueryClient, next: ConversationEntry[]) => {
  entries = next;
  await act(async () => {
    client.setQueryData(["conversations"], { entries, observed_at: T1 });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

let observers: ResizeObserverStub;

beforeEach(() => {
  observers = stubResizeObserver();
  historyStatus = "ready";
  entries = [thread("s1", { updated_at: T1 }), thread("s2", { updated_at: T1 })];
});

afterEach(() => {
  observers.restore();
  mutate.mockReset();
});

describe.each([
  ["Conversations", body],
  [
    "issue page",
    () => <ConversationSection runId="run-1" selectedStepId="s1" onSelectStep={vi.fn()} />,
  ],
  ["run cockpit", () => <RunConversationView />],
])("reading from the %s", (_surface, surface) => {
  it("reads the thread on screen and leaves the issue's other thread unread", async () => {
    const { cleanup } = await mountWithQuery(surface());

    expect(mutate.mock.calls).toEqual([read("s1", T1)]);
    await cleanup();
  });
});

describe("reading a thread on screen", () => {
  it("waits for the thread to load before reading it", async () => {
    historyStatus = "pending";
    const { rerender, cleanup } = await mountWithQuery(body());
    expect(mutate).not.toHaveBeenCalled();

    historyStatus = "ready";
    await rerender(body());

    expect(mutate.mock.calls).toEqual([read("s1", T1)]);
    await cleanup();
  });

  it("never reads a followed thread already read", async () => {
    entries = [thread("s1", { updated_at: T1, read: true })];
    const { cleanup } = await mountWithQuery(body());

    expect(mutate).not.toHaveBeenCalled();
    await cleanup();
  });

  it("still marks a finished thread it shows, so a reopened cycle does not bring it back", async () => {
    entries = [
      thread("s1", {
        updated_at: T1,
        read: true,
        issue: { id: "issue-1", identifier: "OTO-1", title: "Ship it", cycle: null },
      }),
    ];
    const { cleanup } = await mountWithQuery(body());

    expect(mutate.mock.calls).toEqual([read("s1", T1)]);
    await cleanup();
  });

  it("waits for a hidden window to come back before reading", async () => {
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    const { cleanup } = await mountWithQuery(body());
    expect(mutate).not.toHaveBeenCalled();

    visibility.mockReturnValue("visible");
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));

    expect(mutate.mock.calls).toEqual([read("s1", T1)]);
    visibility.mockRestore();
    await cleanup();
  });

  it("reads later activity once, and never again for a refresh of that same activity", async () => {
    const client = testQueryClient();
    await refresh(client, entries);
    const { cleanup } = await mountWithQuery(body(), client);
    await refresh(client, [thread("s1", { updated_at: T1, read: true })]);
    await refresh(client, [thread("s1", { updated_at: T2 })]);
    await refresh(client, [thread("s1", { updated_at: T2 })]);

    expect(mutate.mock.calls).toEqual([read("s1", T1), read("s1", T2)]);
    await cleanup();
  });

  it("leaves activity below the fold unread until the reader jumps back to it", async () => {
    const client = testQueryClient();
    await refresh(client, entries);
    const { cleanup } = await mountWithQuery(body(), client);
    const viewport = findLabelled("Run conversation")?.parentElement;
    if (!viewport) throw new Error("conversation viewport not rendered");
    const scroll = controlScroll(viewport, 400, 2000);
    await act(async () => observers.resize());
    await act(async () => scroll.dragTo(600));

    await refresh(client, [thread("s1", { updated_at: T2 })]);
    expect(mutate.mock.calls).toEqual([read("s1", T1)]);

    const jump = findButton("Jump to latest");
    if (!jump) throw new Error("jump control not rendered");
    await act(async () => jump.click());

    expect(mutate.mock.calls).toEqual([read("s1", T1), read("s1", T2)]);
    await cleanup();
  });
});
