import { INBOX_ENTRY_KINDS, type InboxEntry, type InboxEntryKind } from "@otomat/domain";
import { INBOX_KIND_COPY } from "@web/lib/inbox/labels";

const STATES = ["all", "open", "resolved"] as const;

export interface InboxEntryFilters {
  state: (typeof STATES)[number];
  kinds: InboxEntryKind[];
  projects: string[];
}

export const NO_INBOX_ENTRY_FILTERS: InboxEntryFilters = { state: "open", kinds: [], projects: [] };

export const INBOX_STATE_OPTIONS: { value: InboxEntryFilters["state"]; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "all", label: "Open and resolved" },
];

interface FilterOption<T extends string> {
  value: T;
  label: string;
}

export interface InboxEntryFilterOptions {
  kinds: FilterOption<InboxEntryKind>[];
  projects: FilterOption<string>[];
}

/** `open` is the default view rather than an applied filter, so it never reads as one. */
export function activeInboxEntryFilterCount(filters: InboxEntryFilters): number {
  return (
    [filters.kinds, filters.projects].filter((list) => list.length > 0).length +
    (filters.state === NO_INBOX_ENTRY_FILTERS.state ? 0 : 1)
  );
}

export function applyInboxEntryFilters(
  entries: readonly InboxEntry[],
  filters: InboxEntryFilters,
): InboxEntry[] {
  const kinds = new Set(filters.kinds);
  const projects = new Set(filters.projects);
  return entries.filter(
    (entry) =>
      (filters.state === "all" || entry.state === filters.state) &&
      (kinds.size === 0 || kinds.has(entry.kind)) &&
      (projects.size === 0 || projects.has(entry.project.id)),
  );
}

/** Kinds keep their declared order; projects come from the entries, so an idle project offers no option. */
export function inboxEntryFilterOptions(entries: readonly InboxEntry[]): InboxEntryFilterOptions {
  const present = new Set(entries.map((entry) => entry.kind));
  const projects = new Map<string, FilterOption<string>>();
  for (const entry of entries) {
    projects.set(entry.project.id, { value: entry.project.id, label: entry.project.name });
  }
  return {
    kinds: INBOX_ENTRY_KINDS.filter((kind) => present.has(kind)).map((kind) => ({
      value: kind,
      label: INBOX_KIND_COPY[kind].label,
    })),
    projects: [...projects.values()].toSorted((a, b) => a.label.localeCompare(b.label)),
  };
}
