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
const RESOLVED = inboxEntry({
  id: "run:run-3",
  kind: "run_review_ready",
  state: "resolved",
  read: true,
});
const ARCHIVED = inboxEntry({ id: "run:run-4", archived: true });
const ENTRIES = [OPEN_BLOCKED, OPEN_WAITING, RESOLVED, ARCHIVED];

describe("applyInboxEntryFilters", () => {
  it("hides only what the operator archived by default", () => {
    expect(applyInboxEntryFilters(ENTRIES, NO_INBOX_ENTRY_FILTERS)).toEqual([
      OPEN_BLOCKED,
      OPEN_WAITING,
      RESOLVED,
    ]);
  });

  it("narrows to what was never read", () => {
    const filters = { ...NO_INBOX_ENTRY_FILTERS, view: "unread" as const };

    expect(applyInboxEntryFilters(ENTRIES, filters)).toEqual([OPEN_BLOCKED, OPEN_WAITING]);
  });

  it("shows the archive so an entry can be restored from it", () => {
    const filters = { ...NO_INBOX_ENTRY_FILTERS, view: "archived" as const };

    expect(applyInboxEntryFilters(ENTRIES, filters)).toEqual([ARCHIVED]);
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
      activeInboxEntryFilterCount({ view: "archived", kinds: ["run_failed"], projects: ["p1"] }),
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
