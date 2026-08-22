import {
  activeInboxEntryFilterCount,
  applyInboxEntryFilters,
  inboxEntryFilterOptions,
  NO_INBOX_ENTRY_FILTERS,
} from "@web/lib/inbox/filters";
import { groupInboxEntries } from "@web/lib/inbox/groups";
import { describe, expect, it } from "vitest";

import { inboxEntry } from "#support/inbox";

const OPEN_BLOCKED = inboxEntry();
const OPEN_WAITING = inboxEntry({
  id: "run:run-2",
  kind: "run_awaiting_answer",
  project: { id: "p2", name: "Cockpit" },
});
const RESOLVED = inboxEntry({ id: "run:run-3", kind: "run_review_ready", state: "resolved" });
const ENTRIES = [OPEN_BLOCKED, OPEN_WAITING, RESOLVED];

describe("applyInboxEntryFilters", () => {
  it("shows only what is still open by default", () => {
    expect(applyInboxEntryFilters(ENTRIES, NO_INBOX_ENTRY_FILTERS)).toEqual([
      OPEN_BLOCKED,
      OPEN_WAITING,
    ]);
  });

  it("separates resolved entries from open ones", () => {
    const filters = { ...NO_INBOX_ENTRY_FILTERS, state: "resolved" as const };

    expect(applyInboxEntryFilters(ENTRIES, filters)).toEqual([RESOLVED]);
  });

  it("keeps both states when the operator asks for both", () => {
    const filters = { ...NO_INBOX_ENTRY_FILTERS, state: "all" as const };

    expect(applyInboxEntryFilters(ENTRIES, filters)).toEqual(ENTRIES);
  });

  it("narrows to a type", () => {
    const filters = { ...NO_INBOX_ENTRY_FILTERS, kinds: ["run_failed" as const] };

    expect(applyInboxEntryFilters(ENTRIES, filters)).toEqual([OPEN_BLOCKED]);
  });

  it("narrows to a project", () => {
    const filters = { ...NO_INBOX_ENTRY_FILTERS, projects: ["p2"] };

    expect(applyInboxEntryFilters(ENTRIES, filters)).toEqual([OPEN_WAITING]);
  });
});

describe("activeInboxEntryFilterCount", () => {
  it("does not count the default open-only view as a filter", () => {
    expect(activeInboxEntryFilterCount(NO_INBOX_ENTRY_FILTERS)).toBe(0);
  });

  it("counts each narrowed axis once", () => {
    expect(
      activeInboxEntryFilterCount({ state: "all", kinds: ["run_failed"], projects: ["p1"] }),
    ).toBe(3);
  });
});

describe("inboxEntryFilterOptions", () => {
  it("offers only the types and projects the entries carry", () => {
    const options = inboxEntryFilterOptions(ENTRIES);

    expect(options.kinds.map((option) => option.value)).toEqual([
      "run_failed",
      "run_awaiting_answer",
      "run_review_ready",
    ]);
    expect(options.projects.map((option) => option.label)).toEqual(["Cockpit", "Otomat"]);
  });
});

describe("groupInboxEntries", () => {
  it("reads blocked, then waiting, then resolved, and drops empty sections", () => {
    expect(groupInboxEntries(ENTRIES).map((section) => section.key)).toEqual([
      "blocked",
      "attention",
      "resolved",
    ]);
    expect(groupInboxEntries([OPEN_BLOCKED]).map((section) => section.key)).toEqual(["blocked"]);
  });
});
