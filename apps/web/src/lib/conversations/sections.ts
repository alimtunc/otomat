import { isStepSettled, type ConversationEntry } from "@otomat/domain";

const SECTIONS = [
  { key: "active", label: "Active" },
  { key: "finished", label: "Recently finished" },
] as const;

export type ConversationSectionKey = (typeof SECTIONS)[number]["key"];

export interface ConversationSection {
  key: ConversationSectionKey;
  label: string;
  entries: ConversationEntry[];
}

/** A finished thread the operator has not read yet still sits with the active ones: its outcome is what they came for. */
function sectionOf(entry: ConversationEntry): ConversationSectionKey {
  return isStepSettled(entry.step_status) && entry.read ? "finished" : "active";
}

export function groupConversations(entries: readonly ConversationEntry[]): ConversationSection[] {
  return SECTIONS.map((section) => ({
    key: section.key,
    label: section.label,
    entries: entries.filter((entry) => sectionOf(entry) === section.key),
  })).filter((section) => section.entries.length > 0);
}
