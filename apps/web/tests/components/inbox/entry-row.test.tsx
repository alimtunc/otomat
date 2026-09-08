// @vitest-environment happy-dom
import { InboxEntryRow } from "@web/components/inbox/entry-row";
import { describe, expect, it, vi } from "vitest";

import { findLabelled } from "#support/dom-queries";
import { inboxEntry } from "#support/inbox";
import { mountRouted } from "#support/router";

async function render(entry = inboxEntry(), pending = false) {
  const onMark = vi.fn();
  const onSelectedChange = vi.fn();
  const mounted = await mountRouted(
    <InboxEntryRow
      entry={entry}
      selected={false}
      pending={pending}
      onSelectedChange={onSelectedChange}
      onMark={onMark}
    />,
  );
  const link = mounted.container.querySelector("a");
  if (link === null) throw new Error("inbox row is not a link");
  return { ...mounted, link, onMark, onSelectedChange };
}

function control(label: string): HTMLElement {
  const found = findLabelled(label);
  if (found === undefined) throw new Error(`no control labelled ${label}`);
  return found;
}

describe("InboxEntryRow", () => {
  it("names the cause, the project, the evidence and the action expected", async () => {
    const { container, cleanup } = await render();

    expect(container.textContent).toContain("Run failed");
    expect(container.textContent).toContain("OTO-1");
    expect(container.textContent).toContain("Ship it");
    expect(container.textContent).toContain("Otomat");
    expect(container.textContent).toContain("Check");
    expect(container.textContent).toContain("Resume or abandon the run");
    await cleanup();
  });

  it("leads to the run that stopped", async () => {
    const { link, cleanup } = await render();

    expect(link.getAttribute("href")).toBe("/runs/run-1");
    await cleanup();
  });

  it("leads to the panel where a stopped publication is retried", async () => {
    const { link, cleanup } = await render(
      inboxEntry({
        kind: "publication_stopped",
        target: { kind: "run_pull_request", run_id: "run-1" },
      }),
    );

    expect(link.getAttribute("href")).toBe("/runs/run-1/pr");
    await cleanup();
  });

  it("leads to the reviewer of a pull request that has no run", async () => {
    const { link, container, cleanup } = await render(
      inboxEntry({
        kind: "pull_request_review_requested",
        subject: { title: "feat: adopt it", identifier: null },
        target: { kind: "pull_request", pull_request_id: "pr-1" },
        detail: null,
      }),
    );

    expect(link.getAttribute("href")).toBe("/pull-requests/pr-1/diff");
    expect(container.textContent).toContain("feat: adopt it");
    await cleanup();
  });

  it("keeps every control outside the link", async () => {
    const { container, link, cleanup } = await render();

    expect(link.querySelector("button, [role='checkbox']")).toBeNull();
    expect(container.querySelectorAll("button")).toHaveLength(2);
    expect(container.querySelector("[role='checkbox']")).not.toBeNull();
    await cleanup();
  });

  it("flags an unread entry and offers to mark it read", async () => {
    const { container, onMark, cleanup } = await render();

    expect(container.textContent).toContain("Unread");
    control("Mark as read").click();

    expect(onMark).toHaveBeenCalledWith({ read: true });
    await cleanup();
  });

  it("offers to mark a read entry unread and to archive it", async () => {
    const { container, onMark, cleanup } = await render(inboxEntry({ read: true }));

    expect(container.textContent).not.toContain("Unread");
    control("Mark as unread").click();
    control("Archive").click();

    expect(onMark.mock.calls).toEqual([[{ read: false }], [{ archived: true }]]);
    await cleanup();
  });

  it("offers to restore an archived entry", async () => {
    const { onMark, cleanup } = await render(inboxEntry({ archived: true }));

    control("Restore").click();

    expect(onMark).toHaveBeenCalledWith({ archived: false });
    await cleanup();
  });

  it("disables its controls while a mark is in flight", async () => {
    const { cleanup } = await render(inboxEntry(), true);

    expect(control("Mark as read")).toHaveProperty("disabled", true);
    expect(control("Archive")).toHaveProperty("disabled", true);
    await cleanup();
  });

  it("selects the entry for a bulk action", async () => {
    const { onSelectedChange, cleanup } = await render();

    control("Select Ship it").click();

    expect(onSelectedChange).toHaveBeenCalledWith(true);
    await cleanup();
  });

  it("states a resolved entry as resolved instead of asking for an action", async () => {
    const { container, cleanup } = await render(
      inboxEntry({ kind: "run_review_ready", state: "resolved", detail: null }),
    );

    expect(container.textContent).toContain("Resolved");
    expect(container.textContent).not.toContain("Review the diff");
    await cleanup();
  });
});
