// @vitest-environment happy-dom
import { InboxEntryRow } from "@web/components/inbox/entry-row";
import { describe, expect, it } from "vitest";

import { inboxEntry } from "#support/inbox";
import { mountRouted } from "#support/router";

async function render(entry = inboxEntry()) {
  const mounted = await mountRouted(<InboxEntryRow entry={entry} />);
  const link = mounted.container.querySelector("a");
  if (link === null) throw new Error("inbox row is not a link");
  return { ...mounted, link };
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

  it("states a resolved entry as resolved instead of asking for an action", async () => {
    const { container, cleanup } = await render(
      inboxEntry({ kind: "run_review_ready", state: "resolved", detail: null }),
    );

    expect(container.textContent).toContain("Resolved");
    expect(container.textContent).not.toContain("Review the diff");
    await cleanup();
  });
});
