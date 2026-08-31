import type { PullRequestInboxEntry, PullRequestInboxGroup } from "@otomat/domain";
import { InboxGroup } from "@web/components/inbox/group";
import { ReviewInboxRow } from "@web/components/reviews/entry-row";
import { INBOX_GROUP_COPY } from "@web/lib/pull-request/inbox/groups";

export interface ReviewInboxGroupProps {
  group: PullRequestInboxGroup;
  entries: PullRequestInboxEntry[];
  collapsed: boolean;
  onToggle: (group: PullRequestInboxGroup) => void;
}

export function ReviewInboxGroup({ group, entries, collapsed, onToggle }: ReviewInboxGroupProps) {
  return (
    <InboxGroup
      label={INBOX_GROUP_COPY[group].label}
      count={entries.length}
      collapsed={collapsed}
      onToggle={() => onToggle(group)}
    >
      {entries.map((entry) => (
        <li key={entry.id}>
          <ReviewInboxRow entry={entry} />
        </li>
      ))}
    </InboxGroup>
  );
}
