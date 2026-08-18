import {
  PULL_REQUEST_STATES,
  type PullRequestInboxEntry,
  type PullRequestState,
} from "@otomat/domain";
import { asMember, asRecord, normalizedMembers, normalizedSelection } from "@web/lib/coerce";

const ASSIGNMENTS = ["all", "you", "team"] as const;
const LINKS = ["all", "linked", "unlinked"] as const;

/** Every axis of the inbox; an empty list and `all` both mean the axis is off. */
export interface InboxFilters {
  repositories: string[];
  authors: string[];
  assignment: (typeof ASSIGNMENTS)[number];
  states: PullRequestState[];
  link: (typeof LINKS)[number];
}

export const NO_INBOX_FILTERS: InboxFilters = {
  repositories: [],
  authors: [],
  assignment: "all",
  states: [],
  link: "all",
};

export const INBOX_ASSIGNMENT_OPTIONS: { value: InboxFilters["assignment"]; label: string }[] = [
  { value: "all", label: "Anyone" },
  { value: "you", label: "You" },
  { value: "team", label: "Your team" },
];

export const INBOX_LINK_OPTIONS: { value: InboxFilters["link"]; label: string }[] = [
  { value: "all", label: "Any issue" },
  { value: "linked", label: "Linked to an issue" },
  { value: "unlinked", label: "Not linked" },
];

export function activeInboxFilterCount(filters: InboxFilters): number {
  const lists = [filters.repositories, filters.authors, filters.states];
  return (
    lists.filter((list) => list.length > 0).length +
    [filters.assignment, filters.link].filter((axis) => axis !== "all").length
  );
}

/** The requested-review axis reads the group, which is where the request already decided the entry's place. */
function matchesAssignment(
  entry: PullRequestInboxEntry,
  assignment: InboxFilters["assignment"],
): boolean {
  if (assignment === "all") return true;
  if (assignment === "you") return entry.group === "needs_your_review";
  return entry.group === "needs_team_review";
}

function matchesLink(entry: PullRequestInboxEntry, link: InboxFilters["link"]): boolean {
  if (link === "all") return true;
  return link === "linked" ? entry.issue !== null : entry.issue === null;
}

export function applyInboxFilters(
  entries: readonly PullRequestInboxEntry[],
  filters: InboxFilters,
): PullRequestInboxEntry[] {
  const repositories = new Set(filters.repositories);
  const authors = new Set(filters.authors);
  const states = new Set(filters.states);
  return entries.filter(
    (entry) =>
      (repositories.size === 0 || repositories.has(entry.repository)) &&
      (authors.size === 0 || (entry.author_login !== null && authors.has(entry.author_login))) &&
      (states.size === 0 || states.has(entry.status)) &&
      matchesAssignment(entry, filters.assignment) &&
      matchesLink(entry, filters.link),
  );
}

export function parseInboxFilters(value: unknown): InboxFilters {
  const entry = asRecord(value);
  if (entry === null) return NO_INBOX_FILTERS;
  return {
    repositories: normalizedSelection(entry.repositories),
    authors: normalizedSelection(entry.authors),
    assignment: asMember(entry.assignment, ASSIGNMENTS) ?? NO_INBOX_FILTERS.assignment,
    states: normalizedMembers(entry.states, PULL_REQUEST_STATES),
    link: asMember(entry.link, LINKS) ?? NO_INBOX_FILTERS.link,
  };
}
