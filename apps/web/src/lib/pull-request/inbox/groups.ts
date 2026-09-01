import {
  PULL_REQUEST_INBOX_GROUPS,
  type PullRequestInboxEntry,
  type PullRequestInboxGroup,
} from "@otomat/domain";

export const INBOX_GROUP_COPY = {
  needs_your_review: { label: "Needs your review", action: "Review diff" },
  needs_team_review: { label: "Needs your team’s review", action: "Review diff" },
  your_drafts: { label: "Your drafts", action: "Open" },
  waiting_for_review: { label: "Waiting for review or checks", action: "Open" },
  needs_action: { label: "Needs action", action: "Fix" },
  ready_to_merge: { label: "Ready to merge", action: "Open" },
} satisfies Record<PullRequestInboxGroup, { label: string; action: string }>;

export interface InboxSection {
  group: PullRequestInboxGroup;
  entries: PullRequestInboxEntry[];
}

export function groupInboxEntries(entries: readonly PullRequestInboxEntry[]): InboxSection[] {
  return PULL_REQUEST_INBOX_GROUPS.map((group) => ({
    group,
    entries: entries.filter((entry) => entry.group === group),
  })).filter((section) => section.entries.length > 0);
}
