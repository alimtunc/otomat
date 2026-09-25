import type { ConversationThreadEntry as ConversationEntry } from "@otomat/domain";

const SECTIONS = [
  { key: "active", label: "Following" },
  { key: "finished", label: "Recently finished" },
] as const;

export type ConversationSectionKey = (typeof SECTIONS)[number]["key"];

export interface ConversationIssueGroup {
  id: string;
  issue: ConversationEntry["issue"];
  project: ConversationEntry["project"];
  entries: ConversationEntry[];
}

export interface ConversationSection {
  key: ConversationSectionKey;
  label: string;
  groups: ConversationIssueGroup[];
}

export function sectionOf(entry: ConversationEntry): ConversationSectionKey {
  if ("terminal" in entry) return entry.terminal.state === "exited" ? "finished" : "active";
  return entry.issue.cycle === null ? "finished" : "active";
}

/** Entries arrive newest first, so an issue's group takes the rank of its newest thread. */
function groupByIssue(entries: readonly ConversationEntry[]): ConversationIssueGroup[] {
  const groups = new Map<string, ConversationIssueGroup>();
  for (const entry of entries) {
    const id = entry.issue === null ? `project:${entry.project.id}` : `issue:${entry.issue.id}`;
    const group = groups.get(id);
    if (group === undefined)
      groups.set(id, { id, project: entry.project, issue: entry.issue, entries: [entry] });
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
      groups,
    };
  }).filter((section) => section.groups.length > 0);
}
