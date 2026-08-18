import type { PullRequestInboxEntry, PullRequestInboxGroup } from "@otomat/domain";
import { FOCUS_RING, Icon } from "@otomat/ui";
import { CountBadge } from "@web/components/issues/count-badge";
import { ReviewInboxRow } from "@web/components/reviews/entry-row";
import { INBOX_GROUP_LABEL } from "@web/lib/pull-request/inbox/groups";

export interface ReviewInboxGroupProps {
  group: PullRequestInboxGroup;
  entries: PullRequestInboxEntry[];
  collapsed: boolean;
  onToggle: (group: PullRequestInboxGroup) => void;
}

export function ReviewInboxGroup({ group, entries, collapsed, onToggle }: ReviewInboxGroupProps) {
  const rowsId = `review-group-${group}`;
  return (
    <section className="flex flex-col">
      <h2>
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls={rowsId}
          onClick={() => onToggle(group)}
          className={`flex h-8 w-full items-center gap-2 px-2.5 text-sm font-medium text-foreground ${FOCUS_RING} focus-visible:outline-offset-[-2px]`}
        >
          <Icon
            name="chevron-down"
            size="xs"
            aria-hidden
            className={collapsed ? "-rotate-90 text-text-tertiary" : "text-text-tertiary"}
          />
          <span className="truncate">{INBOX_GROUP_LABEL[group]}</span>
          <CountBadge count={entries.length} tone="neutral" />
        </button>
      </h2>
      {collapsed ? null : (
        <ul id={rowsId} className="flex flex-col gap-0.5 px-2 pb-2">
          {entries.map((entry) => (
            <li key={entry.id}>
              <ReviewInboxRow entry={entry} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
