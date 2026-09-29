import { isConversationFollowed, type ConversationThreadEntry } from "@otomat/domain";

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

export interface ConversationProjectGroup {
  project: ConversationThreadEntry["project"];
  groups: ConversationGroup[];
}

export interface ConversationSection {
  key: ConversationSectionKey;
  label: string;
  projects: ConversationProjectGroup[];
}

export function sectionOf(entry: ConversationThreadEntry): ConversationSectionKey {
  return isConversationFollowed(entry) ? "active" : "finished";
}

/** Entries arrive newest first, so an issue's group takes the rank of its newest thread. */
export function groupConversationsByOwner(
  entries: readonly ConversationThreadEntry[],
): ConversationGroup[] {
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

function groupByProject(groups: readonly ConversationGroup[]): ConversationProjectGroup[] {
  const projects = new Map<string, ConversationProjectGroup>();
  for (const group of groups) {
    const project = projects.get(group.project.id);
    if (project === undefined)
      projects.set(group.project.id, { project: group.project, groups: [group] });
    else project.groups.push(group);
  }
  return [...projects.values()];
}

export function groupConversations(
  entries: readonly ConversationThreadEntry[],
): ConversationSection[] {
  return SECTIONS.map((section) => ({
    key: section.key,
    label: section.label,
    projects: groupByProject(
      groupConversationsByOwner(entries.filter((entry) => sectionOf(entry) === section.key)),
    ),
  })).filter((section) => section.projects.length > 0);
}
