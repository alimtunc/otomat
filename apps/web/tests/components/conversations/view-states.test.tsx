// @vitest-environment happy-dom
import type { ConversationEntry, ConversationSnapshot, StepRunState } from "@otomat/domain";
import type { ConversationsSearch } from "@web/components/conversations/search";
import { ConversationsView } from "@web/components/conversations/view";
import { act, type ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";

import { conversationEntry, terminalConversationEntry } from "#support/conversations";
import type { FakeQueryState } from "#support/fake-query";
import { mount } from "#support/mount";

let conversations: FakeQueryState = {};
let search: ConversationsSearch = {};
const mutate = vi.fn();

vi.mock("@otomat/ui", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useMediaQuery: () => true,
}));

vi.mock("@web/api/conversations/queries", () => ({ useConversations: () => conversations }));
vi.mock("@web/api/conversations/use-conversations-stream", () => ({
  useConversationsStream: () => undefined,
}));
vi.mock("@web/api/conversations/mutations", () => ({
  useMarkConversations: () => ({ mutate, isPending: false }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: ReactNode }) => <a>{children}</a>,
  useSearch: () => search,
  useNavigate: () => vi.fn(),
}));

vi.mock("@web/components/shell/route-shell", () => ({
  RouteShell: ({ actions, children }: { actions?: ReactNode; children: ReactNode }) => (
    <div>
      {actions}
      {children}
    </div>
  ),
}));

vi.mock("@web/api/runs/run-events-provider", () => ({
  RunEventsProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@web/components/conversations/terminal-body", () => ({
  TerminalConversationBody: ({ terminalId }: { terminalId: string }) => (
    <div>terminal {terminalId}</div>
  ),
}));

vi.mock("@web/components/conversations/thread-body", () => ({
  ConversationThreadBody: ({ runId, stepRunId }: { runId: string; stepRunId: string }) => (
    <div>
      thread {runId}/{stepRunId}
    </div>
  ),
}));

vi.mock("@web/components/diagnostics/error-report", () => ({
  ErrorReport: ({ context }: { context?: string }) => <div>{context}</div>,
}));

function snapshot(entries: ConversationSnapshot["entries"]): ConversationSnapshot {
  return { entries, observed_at: "2026-09-19T10:00:00.000Z" };
}

function loaded(entries: ConversationEntry[]): FakeQueryState {
  return { data: snapshot(entries), dataUpdatedAt: Date.now(), refetch: vi.fn() };
}

function thread(issue: string, step: string, step_status: StepRunState): ConversationEntry {
  return conversationEntry({
    id: `conversation:${step}`,
    step_run_id: step,
    step_name: step,
    step_status,
    issue: { id: issue, identifier: issue, title: issue, cycle: "running" },
  });
}

function groupHeader(container: HTMLElement, title: string): HTMLButtonElement {
  const header = [...container.querySelectorAll<HTMLButtonElement>("h3 button")].find((button) =>
    button.textContent.includes(title),
  );
  if (header === undefined) throw new Error(`no group ${title}`);
  return header;
}

const spinningRows = (container: HTMLElement): Element[] =>
  [...container.querySelectorAll("a")].filter((row) => row.querySelector(".animate-spin") !== null);

beforeEach(() => {
  mutate.mockReset();
  search = {};
});

it("waits on its skeleton rather than an empty list", async () => {
  conversations = { isPending: true, data: undefined, refetch: vi.fn() };

  const { container, cleanup } = await mount(<ConversationsView />);

  expect(container.textContent).not.toContain("No conversations yet");
  await cleanup();
});

it("invites a launch when the host holds no thread, and a selection when it does", async () => {
  conversations = loaded([]);

  const { container, cleanup } = await mount(<ConversationsView />);

  expect(container.textContent).toContain("No conversations yet");
  expect(container.textContent).toContain("Select a conversation");
  await cleanup();
});

it("keeps the loaded threads on screen when a refresh fails", async () => {
  conversations = {
    isError: true,
    data: snapshot([conversationEntry()]),
    dataUpdatedAt: Date.now(),
    isFetching: false,
    refetch: vi.fn(),
    error: new Error("refresh failed"),
  };

  const { container, cleanup } = await mount(<ConversationsView />);

  expect(container.textContent).toContain("Couldn’t refresh");
  expect(container.textContent).toContain("Ship it");
  expect(container.textContent).not.toContain("Couldn’t load the conversations");
  await cleanup();
});

it("opens the thread the URL names and reads it once it is on screen", async () => {
  conversations = loaded([
    conversationEntry(),
    conversationEntry({ id: "conversation:step-2", step_run_id: "step-2" }),
  ]);
  search = { run: "run-1", step: "step-2" };

  const { container, cleanup } = await mount(<ConversationsView />);

  expect(container.textContent).toContain("thread run-1/step-2");
  expect(mutate).toHaveBeenCalledTimes(1);
  expect(mutate).toHaveBeenCalledWith({
    marks: [
      {
        entry_id: "conversation:step-2",
        read: true,
        archived: false,
        evidence_updated_at: "2026-09-19T10:00:00.000Z",
      },
    ],
  });
  await cleanup();
});

it("does not read a thread that is already read, nor one the host does not list", async () => {
  conversations = loaded([conversationEntry({ read: true })]);
  search = { run: "run-1", step: "step-1" };
  const read = await mount(<ConversationsView />);
  expect(mutate).not.toHaveBeenCalled();
  await read.cleanup();

  search = { run: "run-9", step: "step-9" };
  const foreign = await mount(<ConversationsView />);
  expect(foreign.container.textContent).toContain("thread run-9/step-9");
  expect(mutate).not.toHaveBeenCalled();
  await foreign.cleanup();
});

it("moves an issue out of Following on the frame that closes its cycle", async () => {
  conversations = loaded([conversationEntry()]);
  const { container, rerender, cleanup } = await mount(<ConversationsView />);
  const sectionOf = () =>
    [...container.querySelectorAll("h2")].map((heading) => heading.textContent);
  expect(sectionOf()).toEqual(["Following1"]);

  conversations = loaded([
    conversationEntry({
      step_status: "succeeded",
      issue: { id: "issue-1", identifier: "OTO-1", title: "Ship it", cycle: null },
    }),
  ]);
  await rerender(<ConversationsView />);

  expect(sectionOf()).toEqual(["Recently finished11 unread"]);
  await cleanup();
});

it("opens only the issues holding a running thread, and keeps one the operator folded", async () => {
  const entries = [
    thread("Live", "live-run", "running"),
    thread("Live", "live-done", "succeeded"),
    thread("Queue", "queue-a", "queued"),
    thread("Queue", "queue-b", "queued"),
    thread("Done", "done-ok", "succeeded"),
    thread("Done", "done-ko", "failed"),
    thread("Stopped", "stopped-a", "canceled"),
    thread("Stopped", "stopped-b", "canceled"),
  ];
  conversations = loaded(entries);
  const { container, rerender, cleanup } = await mount(<ConversationsView />);
  const expanded = (title: string) => groupHeader(container, title).getAttribute("aria-expanded");

  expect(["Live", "Queue", "Done", "Stopped"].map(expanded)).toEqual([
    "true",
    "false",
    "false",
    "false",
  ]);
  expect(spinningRows(container)).toHaveLength(1);

  await act(async () => groupHeader(container, "Live").click());
  conversations = loaded([...entries]);
  await rerender(<ConversationsView />);

  expect(expanded("Live")).toBe("false");
  await cleanup();
});

it("spins only on a row whose agent is working", async () => {
  conversations = loaded([
    thread("Working", "working", "running"),
    {
      ...thread("Asking", "asking", "running"),
      pending_interaction: { kind: "permission", prompt: "Run?" },
    },
    thread("Queued", "queued", "queued"),
    thread("Succeeded", "succeeded", "succeeded"),
    thread("Failed", "failed", "failed"),
    thread("Canceled", "canceled", "canceled"),
  ]);
  const { container, cleanup } = await mount(<ConversationsView />);

  expect(container.querySelectorAll("a")).toHaveLength(6);
  expect(spinningRows(container).map((row) => row.textContent)).toEqual([
    expect.stringContaining("Working"),
  ]);
  await cleanup();
});

it("drops the loader and folds its issue back on the frame the thread settles", async () => {
  conversations = loaded([
    thread("Live", "a", "running"),
    thread("Live", "b", "succeeded"),
    thread("Solo", "solo", "running"),
  ]);
  const { container, rerender, cleanup } = await mount(<ConversationsView />);
  expect(groupHeader(container, "Live").getAttribute("aria-expanded")).toBe("true");
  expect(spinningRows(container)).toHaveLength(2);

  conversations = loaded([
    thread("Live", "a", "succeeded"),
    thread("Live", "b", "succeeded"),
    thread("Solo", "solo", "failed"),
  ]);
  await rerender(<ConversationsView />);

  expect(groupHeader(container, "Live").getAttribute("aria-expanded")).toBe("false");
  expect(container.textContent).toContain("Solo");
  expect(container.querySelector(".animate-spin")).toBeNull();
  await cleanup();
});

it("opens and marks a terminal without selecting a cockpit step", async () => {
  const entry = terminalConversationEntry();
  conversations = {
    data: snapshot([conversationEntry(), entry]),
    dataUpdatedAt: Date.now(),
    refetch: vi.fn(),
  };
  search = { terminal: entry.terminal.id };
  const { container, cleanup } = await mount(<ConversationsView />);
  expect(container.textContent).toContain(`terminal ${entry.terminal.id}`);
  expect(container.textContent).not.toContain("thread run-1/step-1");
  expect(mutate).toHaveBeenCalledWith({
    marks: [
      { entry_id: entry.id, read: true, archived: false, evidence_updated_at: entry.updated_at },
    ],
  });
  await cleanup();
});
