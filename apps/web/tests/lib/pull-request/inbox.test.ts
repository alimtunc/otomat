import type { PullRequestInboxEntry } from "@otomat/domain";
import {
  applyInboxFilters,
  activeInboxFilterCount,
  NO_INBOX_FILTERS,
} from "@web/lib/pull-request/inbox/filters";
import { inboxFilterOptions } from "@web/lib/pull-request/inbox/options";
import { readInboxView, writeInboxView } from "@web/lib/pull-request/inbox/view";
import { expect, it } from "vitest";

import { memoryStorage } from "#support/storage";

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
    review_decision: null,
    checks_state: "none",
    mergeable: "mergeable",
    head_ref: "contrib/fix",
    base_ref: "main",
    updated_at: "2026-08-18T10:00:00.000Z",
    run_id: null,
    issue: null,
    head_fetched: false,
    ...overrides,
  };
}

const LINKED = entry({
  id: "pr-2",
  number: 8,
  repository: "acme/tools",
  author_login: "operator",
  group: "your_drafts",
  status: "draft",
  issue: {
    id: "i1",
    identifier: "OTO-113",
    title: "Reviews inbox",
    status: "ready",
    evidence: "reference",
  },
});

it("narrows on every axis, and counts only the axes that are on", () => {
  const entries = [entry(), LINKED];
  expect(activeInboxFilterCount(NO_INBOX_FILTERS)).toBe(0);
  expect(applyInboxFilters(entries, NO_INBOX_FILTERS)).toHaveLength(2);

  const filters = { ...NO_INBOX_FILTERS, link: "linked" as const, repositories: ["acme/tools"] };
  expect(activeInboxFilterCount(filters)).toBe(2);
  expect(applyInboxFilters(entries, filters).map((found) => found.id)).toEqual(["pr-2"]);

  expect(
    applyInboxFilters(entries, { ...NO_INBOX_FILTERS, authors: ["contrib"] }).map((f) => f.id),
  ).toEqual(["pr-1"]);
  expect(
    applyInboxFilters(entries, { ...NO_INBOX_FILTERS, states: ["draft"] }).map((f) => f.id),
  ).toEqual(["pr-2"]);
  expect(
    applyInboxFilters(entries, { ...NO_INBOX_FILTERS, assignment: "you" }).map((f) => f.id),
  ).toEqual(["pr-1"]);
});

it("offers only the values the loaded entries actually carry", () => {
  const options = inboxFilterOptions([entry(), LINKED]);
  expect(options.repositories.map((option) => option.value)).toEqual(["acme/otomat", "acme/tools"]);
  expect(options.authors.map((option) => option.label)).toEqual(["@contrib", "@operator"]);
  expect(options.states.map((option) => option.value)).toEqual(["draft", "open"]);
});

it("keeps filters and folded groups per project, and falls back to the defaults", () => {
  const storage = memoryStorage();
  writeInboxView(
    "p1",
    { filters: { ...NO_INBOX_FILTERS, link: "unlinked" }, collapsedGroups: ["your_drafts"] },
    storage,
  );

  expect(readInboxView("p1", storage)).toEqual({
    filters: { ...NO_INBOX_FILTERS, link: "unlinked" },
    collapsedGroups: ["your_drafts"],
  });
  expect(readInboxView("p2", storage)).toEqual({
    filters: NO_INBOX_FILTERS,
    collapsedGroups: [],
  });
});
