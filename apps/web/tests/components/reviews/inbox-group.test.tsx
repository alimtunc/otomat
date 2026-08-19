// @vitest-environment happy-dom
import type { PullRequestInboxEntry } from "@otomat/domain";
import { ReviewInboxGroup } from "@web/components/reviews/group-section";
import { afterEach, expect, it, vi } from "vitest";

import { type Mounted } from "#support/mount";
import { mountRouted } from "#support/router";

const mounted: Mounted[] = [];

function entry(overrides: Partial<PullRequestInboxEntry> = {}): PullRequestInboxEntry {
  return {
    id: "pr-1",
    group: "needs_your_review",
    repository: "acme/otomat",
    number: 7,
    title: "Contributor fix",
    url: "https://github.com/acme/otomat/pull/7",
    author_login: "contrib",
    status: "open",
    provenance: "external",
    review_decision: "changes_requested",
    checks_state: "failing",
    mergeable: "conflicting",
    head_ref: "contrib/fix",
    base_ref: "main",
    updated_at: "2026-08-18T10:00:00.000Z",
    run_id: null,
    issue: null,
    head_fetched: false,
    ...overrides,
  };
}

afterEach(async () => {
  for (const rendered of mounted.splice(0)) await rendered.cleanup();
  document.body.replaceChildren();
});

async function render(entries: PullRequestInboxEntry[], collapsed = false): Promise<HTMLElement> {
  const rendered = await mountRouted(
    <ReviewInboxGroup
      group="needs_your_review"
      entries={entries}
      collapsed={collapsed}
      onToggle={vi.fn()}
    />,
  );
  mounted.push(rendered);
  return rendered.container;
}

it("heads the group with its label and count, and links each entry to its reviewer", async () => {
  const container = await render([entry(), entry({ id: "pr-2", number: 8 })]);

  expect(container.querySelector("button[aria-expanded]")?.textContent).toBe("Needs your review2");
  expect([...container.querySelectorAll("li a")].map((link) => link.getAttribute("href"))).toEqual([
    "/pull-requests/pr-1/diff",
    "/pull-requests/pr-2/diff",
  ]);
});

it("states what GitHub answered about the head, provenance included", async () => {
  const container = await render([entry()]);
  const text = container.textContent ?? "";

  expect(text).toContain("acme/otomat#7");
  expect(text).toContain("@contrib");
  expect(text).toContain("Changes requested");
  expect(text).toContain("Checks failing");
  expect(text).toContain("Conflicts");
  expect(text).toContain("External");
});

it("shows the linked issue under the title when one is proven", async () => {
  const container = await render([
    entry({
      issue: {
        id: "i1",
        identifier: "OTO-113",
        title: "Reviews inbox",
        status: "ready",
        evidence: "reference",
      },
    }),
  ]);

  expect(container.textContent).toContain("OTO-113 · Reviews inbox");
  expect(container.textContent).toContain("(named, not attached)");
});

it("marks a named issue apart from an attached one, so a reference never reads as adopted", async () => {
  const container = await render([
    entry({
      issue: {
        id: "i1",
        identifier: "OTO-113",
        title: "Reviews inbox",
        status: "ready",
        evidence: "attachment",
      },
    }),
  ]);

  expect(container.textContent).toContain("OTO-113 · Reviews inbox");
  expect(container.textContent).not.toContain("(named, not attached)");
});

it("folds the rows away without dropping the header or the count", async () => {
  const container = await render([entry()], true);

  expect(container.querySelector("button[aria-expanded]")?.getAttribute("aria-expanded")).toBe(
    "false",
  );
  expect(container.querySelectorAll("li")).toHaveLength(0);
  expect(container.textContent).toContain("Needs your review1");
});
