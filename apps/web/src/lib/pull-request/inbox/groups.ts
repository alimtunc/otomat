import {
  PULL_REQUEST_INBOX_GROUPS,
  type PullRequestInboxEntry,
  type PullRequestInboxGroup,
} from "@otomat/domain";

export const INBOX_GROUP_LABEL: Record<PullRequestInboxGroup, string> = {
  needs_your_review: "Needs your review",
  needs_team_review: "Needs your team’s review",
  your_drafts: "Your drafts",
  waiting_for_review: "Waiting for review or checks",
  needs_action: "Needs action",
  ready_to_merge: "Ready to merge",
};

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
