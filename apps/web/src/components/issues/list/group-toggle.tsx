import { Icon } from "@otomat/ui";
import { CountBadge } from "@web/components/issues/count-badge";
import { IssueGroupHeading } from "@web/components/issues/list/group-heading";
import type { IssueGroup } from "@web/lib/issue/grouping";

export function IssueGroupToggle({
  group,
  collapsed,
  onToggle,
  className,
  controls,
}: {
  group: IssueGroup;
  collapsed: boolean;
  onToggle: (key: string) => void;
  className: string;
  controls?: string;
}) {
  return (
    <button
      type="button"
      aria-expanded={!collapsed}
      aria-controls={controls}
      onClick={() => onToggle(group.key)}
      className={`flex items-center gap-2 text-sm font-medium text-foreground ${className}`}
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
