import { FOCUS_RING_INSET, Icon } from "@otomat/ui";
import { CountBadge } from "@web/components/issues/count-badge";
import { IssueGroupHeading } from "@web/components/issues/list/group-heading";
import type { IssueGroup } from "@web/lib/issue/grouping";

export function IssueGroupSection({
  group,
  collapsed,
  onToggle,
}: {
  group: IssueGroup;
  collapsed: boolean;
  onToggle: (key: string) => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={!collapsed}
      onClick={() => onToggle(group.key)}
      className={`flex h-8 w-full items-center gap-2 px-3 text-sm font-medium text-foreground ${FOCUS_RING_INSET}`}
    >
      <Icon
        name="chevron-down"
        size="xs"
        aria-hidden
        className={collapsed ? "-rotate-90 text-text-tertiary" : "text-text-tertiary"}
      />
      <IssueGroupHeading group={group} />
      <CountBadge count={group.issues.length} tone="neutral" />
    </button>
  );
}
