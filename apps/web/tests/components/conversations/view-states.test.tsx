// @vitest-environment happy-dom
import type { ConversationSnapshot } from "@otomat/domain";
import type { ConversationsSearch } from "@web/components/conversations/search";
import { ConversationsView } from "@web/components/conversations/view";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";

import { conversationEntry } from "#support/conversations";
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
  conversations = { data: snapshot([]), dataUpdatedAt: Date.now(), refetch: vi.fn() };

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
  conversations = {
    data: snapshot([
      conversationEntry(),
      conversationEntry({ id: "conversation:step-2", step_run_id: "step-2" }),
    ]),
    dataUpdatedAt: Date.now(),
    refetch: vi.fn(),
  };
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
  conversations = {
    data: snapshot([conversationEntry({ read: true })]),
    dataUpdatedAt: Date.now(),
    refetch: vi.fn(),
  };
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
  conversations = {
    data: snapshot([conversationEntry()]),
    dataUpdatedAt: Date.now(),
    refetch: vi.fn(),
  };
  const { container, rerender, cleanup } = await mount(<ConversationsView />);
  const sectionOf = () =>
    [...container.querySelectorAll("h2")].map((heading) => heading.textContent);
  expect(sectionOf()).toEqual(["Following1"]);

  conversations = {
    data: snapshot([
      conversationEntry({
        step_status: "succeeded",
        issue: { id: "issue-1", identifier: "OTO-1", title: "Ship it", cycle: null },
      }),
    ]),
    dataUpdatedAt: Date.now(),
    refetch: vi.fn(),
  };
  await rerender(<ConversationsView />);

  expect(sectionOf()).toEqual(["Recently finished11 unread"]);
  await cleanup();
});
