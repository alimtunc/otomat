// @vitest-environment happy-dom
import type { InboxSnapshot } from "@otomat/domain";
import { InboxView } from "@web/components/inbox/inbox-view";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";

import type { FakeQueryState } from "#support/fake-query";
import { inboxEntry } from "#support/inbox";
import { mount } from "#support/mount";

let inbox: FakeQueryState = {};

vi.mock("@web/api/inbox/queries", () => ({ useInbox: () => inbox }));

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

it("separates an inbox nothing matched from a host with nothing to report", async () => {
  inbox = {
    data: snapshot([inboxEntry({ state: "resolved", kind: "run_review_ready" })]),
    dataUpdatedAt: Date.now(),
    refetch: vi.fn(),
  };

  const { container, cleanup } = await mount(<InboxView />);

  expect(container.textContent).toContain("No entry matches these filters");
  await cleanup();
});
