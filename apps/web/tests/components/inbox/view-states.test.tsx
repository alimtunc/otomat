// @vitest-environment happy-dom
import type { InboxSnapshot } from "@otomat/domain";
import { InboxView } from "@web/components/inbox/inbox-view";
import { act, type ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";

import { findButton, findLabelled } from "#support/dom-queries";
import type { FakeQueryState } from "#support/fake-query";
import { inboxEntry } from "#support/inbox";
import { mount } from "#support/mount";

let inbox: FakeQueryState = {};
const mutate = vi.fn();

vi.mock("@web/api/inbox/queries", () => ({ useInbox: () => inbox }));
vi.mock("@web/api/inbox/mutations", () => ({
  useMarkInbox: () => ({ mutate, isPending: false }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: ReactNode }) => <a>{children}</a>,
}));

vi.mock("@web/components/shell/route-shell", () => ({
  RouteShell: ({ actions, children }: { actions?: ReactNode; children: ReactNode }) => (
    <div>
      {actions}
      {children}
    </div>
  ),
}));

vi.mock("@web/components/diagnostics/error-report", () => ({
  ErrorReport: ({ context }: { context?: string }) => <div>{context}</div>,
}));

function snapshot(entries: InboxSnapshot["entries"]): InboxSnapshot {
  return { entries, observed_at: "2026-08-22T10:00:00.000Z" };
}

function control(name: string): HTMLElement {
  const found = findButton(name) ?? findLabelled(name);
  if (found === undefined) throw new Error(`no control named ${name}`);
  return found;
}

beforeEach(() => {
  mutate.mockReset();
});

it("waits on its skeleton rather than an empty inbox", async () => {
  inbox = { isPending: true, data: undefined, refetch: vi.fn() };

  const { container, cleanup } = await mount(<InboxView />);

  expect(container.textContent).not.toContain("Nothing needs your attention");
  await cleanup();
});

it("says nothing needs the operator when the host reported nothing", async () => {
  inbox = { data: snapshot([]), dataUpdatedAt: Date.now(), refetch: vi.fn() };

  const { container, cleanup } = await mount(<InboxView />);

  expect(container.textContent).toContain("Nothing needs your attention");
  await cleanup();
});

it("keeps the loaded entries on screen when a refresh fails", async () => {
  inbox = {
    isError: true,
    data: snapshot([inboxEntry()]),
    dataUpdatedAt: Date.now(),
    isFetching: false,
    refetch: vi.fn(),
    error: new Error("refresh failed"),
  };

  const { container, cleanup } = await mount(<InboxView />);

  expect(container.textContent).toContain("Couldn’t refresh");
  expect(container.textContent).toContain("Ship it");
  expect(container.textContent).not.toContain("Couldn’t load the Inbox");
  await cleanup();
});

it("blocks on the error report only when nothing was ever loaded", async () => {
  inbox = { isError: true, data: undefined, refetch: vi.fn(), error: new Error("daemon down") };

  const { container, cleanup } = await mount(<InboxView />);

  expect(container.textContent).toContain("Couldn’t load the Inbox");
  await cleanup();
});

it("counts each section and hides the ones nothing landed in", async () => {
  inbox = {
    data: snapshot([
      inboxEntry(),
      inboxEntry({ id: "run:run-2", kind: "run_awaiting_answer" }),
      inboxEntry({ id: "run:run-3", kind: "run_awaiting_selection" }),
    ]),
    dataUpdatedAt: Date.now(),
    refetch: vi.fn(),
  };

  const { container, cleanup } = await mount(<InboxView />);
  const sections = [...container.querySelectorAll("h2")].map((node) => node.textContent);

  expect(sections).toEqual(["Blocked1", "Waiting on you2"]);
  await cleanup();
});

it("treats an inbox the operator cleared as nothing to report, not as a filter", async () => {
  inbox = {
    data: snapshot([inboxEntry({ archived: true })]),
    dataUpdatedAt: Date.now(),
    refetch: vi.fn(),
  };

  const { container, cleanup } = await mount(<InboxView />);

  expect(container.textContent).toContain("Nothing needs your attention");
  expect(container.textContent).not.toContain("Ship it");
  await cleanup();
});

it("marks every visible unread entry read with the evidence it was shown on", async () => {
  inbox = {
    data: snapshot([
      inboxEntry(),
      inboxEntry({ id: "run:run-2", read: true }),
      inboxEntry({ id: "run:run-3", archived: true }),
    ]),
    dataUpdatedAt: Date.now(),
    refetch: vi.fn(),
  };

  const { cleanup } = await mount(<InboxView />);
  control("Mark all read").click();

  expect(mutate).toHaveBeenCalledWith(
    {
      marks: [
        {
          entry_id: "run:run-1",
          evidence_updated_at: "2026-08-22T10:00:00.000Z",
          read: true,
          archived: false,
        },
      ],
    },
    expect.anything(),
  );
  await cleanup();
});

it("archives what was read, leaving the unread entries in place", async () => {
  inbox = {
    data: snapshot([inboxEntry(), inboxEntry({ id: "run:run-2", read: true })]),
    dataUpdatedAt: Date.now(),
    refetch: vi.fn(),
  };

  const { cleanup } = await mount(<InboxView />);
  control("Archive read").click();

  expect(mutate).toHaveBeenCalledWith(
    { marks: [expect.objectContaining({ entry_id: "run:run-2", archived: true })] },
    expect.anything(),
  );
  await cleanup();
});

it("acts on the selection instead of the whole view once an entry is selected", async () => {
  inbox = {
    data: snapshot([
      inboxEntry(),
      inboxEntry({ id: "run:run-2", subject: { title: "Other", identifier: null } }),
    ]),
    dataUpdatedAt: Date.now(),
    refetch: vi.fn(),
  };

  const { container, cleanup } = await mount(<InboxView />);
  await act(async () => {
    control("Select Other").click();
  });

  expect(container.textContent).toContain("1 selected");
  expect(container.textContent).not.toContain("Mark all read");
  control("Archive").click();

  expect(mutate).toHaveBeenCalledWith(
    { marks: [expect.objectContaining({ entry_id: "run:run-2", archived: true })] },
    expect.anything(),
  );
  await cleanup();
});

it("marks one entry from its row without touching the rest", async () => {
  inbox = {
    data: snapshot([inboxEntry(), inboxEntry({ id: "run:run-2" })]),
    dataUpdatedAt: Date.now(),
    refetch: vi.fn(),
  };

  const { cleanup } = await mount(<InboxView />);
  control("Archive").click();

  expect(mutate).toHaveBeenCalledWith(
    { marks: [expect.objectContaining({ entry_id: "run:run-1", archived: true })] },
    expect.anything(),
  );
  await cleanup();
});
