import type { ConversationEntry } from "@otomat/domain";

const SECTIONS = [
  { key: "active", label: "Following" },
  { key: "finished", label: "Recently finished" },
] as const;

/** The finished section is a glance at the day, not an archive. */
const FINISHED_GROUP_LIMIT = 10;

export type ConversationSectionKey = (typeof SECTIONS)[number]["key"];

export interface ConversationIssueGroup {
  issue: ConversationEntry["issue"];
  entries: ConversationEntry[];
}

export interface ConversationSection {
  key: ConversationSectionKey;
  label: string;
  groups: ConversationIssueGroup[];
}

export function sectionOf(entry: ConversationEntry): ConversationSectionKey {
  return entry.issue.cycle === null ? "finished" : "active";
}

/** Entries arrive newest first, so an issue's group takes the rank of its newest thread. */
function groupByIssue(entries: readonly ConversationEntry[]): ConversationIssueGroup[] {
  const groups = new Map<string, ConversationIssueGroup>();
  for (const entry of entries) {
    const group = groups.get(entry.issue.id);
    if (group === undefined) groups.set(entry.issue.id, { issue: entry.issue, entries: [entry] });
    else group.entries.push(entry);
  }
  return [...groups.values()];
}

export function groupConversations(entries: readonly ConversationEntry[]): ConversationSection[] {
  return SECTIONS.map((section) => {
    const groups = groupByIssue(entries.filter((entry) => sectionOf(entry) === section.key));
    return {
      key: section.key,
      label: section.label,
      groups: section.key === "finished" ? groups.slice(0, FINISHED_GROUP_LIMIT) : groups,
    };
  }).filter((section) => section.groups.length > 0);
}
