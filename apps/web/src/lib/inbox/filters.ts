import { INBOX_ENTRY_KINDS, type InboxEntry, type InboxEntryKind } from "@otomat/domain";
import { INBOX_KIND_COPY } from "@web/lib/inbox/labels";

const VIEWS = ["open", "unread", "archived"] as const;
export type InboxViewFilter = (typeof VIEWS)[number];

export interface InboxEntryFilters {
  view: InboxViewFilter;
  kinds: InboxEntryKind[];
  projects: string[];
}

export const NO_INBOX_ENTRY_FILTERS: InboxEntryFilters = { view: "open", kinds: [], projects: [] };

export const INBOX_VIEW_OPTIONS: { value: InboxViewFilter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "unread", label: "Unread" },
  { value: "archived", label: "Archived" },
];

interface FilterOption<T extends string> {
  value: T;
  label: string;
}

export interface InboxEntryFilterOptions {
  kinds: FilterOption<InboxEntryKind>[];
  projects: FilterOption<string>[];
}

export function activeInboxEntryFilterCount(filters: InboxEntryFilters): number {
  return (
    [filters.kinds, filters.projects].filter((list) => list.length > 0).length +
    (filters.view === NO_INBOX_ENTRY_FILTERS.view ? 0 : 1)
  );
}

function inView(entry: InboxEntry, view: InboxViewFilter): boolean {
  if (view === "archived") return entry.archived;
  return !entry.archived && (view === "open" || !entry.read);
}

export function applyInboxEntryFilters(
  entries: readonly InboxEntry[],
  filters: InboxEntryFilters,
): InboxEntry[] {
  const kinds = new Set(filters.kinds);
  const projects = new Set(filters.projects);
  return entries.filter(
    (entry) =>
      inView(entry, filters.view) &&
      (kinds.size === 0 || kinds.has(entry.kind)) &&
      (projects.size === 0 || projects.has(entry.project.id)),
  );
}

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
