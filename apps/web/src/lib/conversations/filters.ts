import { isStepSettled, type ConversationEntry } from "@otomat/domain";

const STATES = ["all", "active", "waiting", "finished"] as const;
export type ConversationStateFilter = (typeof STATES)[number];

export interface ConversationFilters {
  state: ConversationStateFilter;
  unread: boolean;
  projects: string[];
}

export const NO_CONVERSATION_FILTERS: ConversationFilters = {
  state: "all",
  unread: false,
  projects: [],
};

export const CONVERSATION_STATE_OPTIONS: { value: ConversationStateFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "waiting", label: "Waiting on you" },
  { value: "finished", label: "Finished" },
];

export interface ConversationProjectOption {
  value: string;
  label: string;
}

/** A pending question waits on the operator whatever state the step reads. */
function isWaitingOnOperator(entry: ConversationEntry): boolean {
  return (
    entry.pending_interaction !== null ||
    entry.step_status === "awaiting_permission" ||
    entry.step_status === "awaiting_human"
  );
}

function inState(entry: ConversationEntry, state: ConversationStateFilter): boolean {
  switch (state) {
    case "all":
      return true;
    case "active":
      return !isStepSettled(entry.step_status);
    case "waiting":
      return isWaitingOnOperator(entry);
    case "finished":
      return isStepSettled(entry.step_status);
  }
}

export function activeConversationFilterCount(filters: ConversationFilters): number {
  return (
    (filters.state === "all" ? 0 : 1) +
    (filters.unread ? 1 : 0) +
    (filters.projects.length > 0 ? 1 : 0)
  );
}

/** Archived threads stay out of every filter: they come back on their own when they speak again. */
export function applyConversationFilters(
  entries: readonly ConversationEntry[],
  filters: ConversationFilters,
): ConversationEntry[] {
  const projects = new Set(filters.projects);
  return entries.filter(
    (entry) =>
      !entry.archived &&
      inState(entry, filters.state) &&
      (!filters.unread || !entry.read) &&
      (projects.size === 0 || projects.has(entry.project.id)),
  );
}

export function conversationProjectOptions(
  entries: readonly ConversationEntry[],
): ConversationProjectOption[] {
  const projects = new Map<string, ConversationProjectOption>();
  for (const entry of entries) {
    projects.set(entry.project.id, { value: entry.project.id, label: entry.project.name });
  }
  return [...projects.values()].toSorted((a, b) => a.label.localeCompare(b.label));
}
