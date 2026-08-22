import { INBOX_SEVERITY, type InboxEntry } from "@otomat/domain";

const SECTIONS = [
  { key: "blocked", label: "Blocked" },
  { key: "attention", label: "Waiting on you" },
  { key: "resolved", label: "Recently resolved" },
] as const;

export type InboxSectionKey = (typeof SECTIONS)[number]["key"];

export interface InboxSection {
  key: InboxSectionKey;
  label: string;
  entries: InboxEntry[];
}

function sectionOf(entry: InboxEntry): InboxSectionKey {
  return entry.state === "resolved" ? "resolved" : INBOX_SEVERITY[entry.kind];
}

/** Sections in reading order, empty ones dropped so no heading stands over nothing; entries keep the daemon's order. */
export function groupInboxEntries(entries: readonly InboxEntry[]): InboxSection[] {
  return SECTIONS.map((section) => ({
    key: section.key,
    label: section.label,
    entries: entries.filter((entry) => sectionOf(entry) === section.key),
  })).filter((section) => section.entries.length > 0);
}
