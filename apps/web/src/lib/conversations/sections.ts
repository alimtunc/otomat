import type { ConversationThreadEntry } from "@otomat/domain";

const SECTIONS = [
  { key: "active", label: "Following" },
  { key: "finished", label: "Recently finished" },
] as const;

export type ConversationSectionKey = (typeof SECTIONS)[number]["key"];

export interface ConversationGroup {
  id: string;
  issue: ConversationThreadEntry["issue"];
  project: ConversationThreadEntry["project"];
  entries: ConversationThreadEntry[];
}

export interface ConversationSection {
  key: ConversationSectionKey;
  label: string;
  groups: ConversationGroup[];
}

export function sectionOf(entry: ConversationThreadEntry): ConversationSectionKey {
  const running = "terminal" in entry && entry.terminal.state !== "exited";
  return running || (entry.issue !== null && entry.issue.cycle !== null) ? "active" : "finished";
}

/** Entries arrive newest first, so an issue's group takes the rank of its newest thread. */
function groupByOwner(entries: readonly ConversationThreadEntry[]): ConversationGroup[] {
  const groups = new Map<string, ConversationGroup>();
  for (const entry of entries) {
    const id = entry.issue === null ? `project:${entry.project.id}` : `issue:${entry.issue.id}`;
    const group = groups.get(id);
    if (group === undefined)
      groups.set(id, { id, project: entry.project, issue: entry.issue, entries: [entry] });
    else group.entries.push(entry);
  }
  return [...groups.values()];
}

export function groupConversations(
  entries: readonly ConversationThreadEntry[],
): ConversationSection[] {
  return SECTIONS.map((section) => {
    const groups = groupByOwner(entries.filter((entry) => sectionOf(entry) === section.key));
    return {
      key: section.key,
      label: section.label,
      groups,
    };
  }).filter((section) => section.groups.length > 0);
}
