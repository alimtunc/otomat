import { Badge, cn, FOCUS_RING_INSET, HostTag, Icon } from "@otomat/ui";
import type { ProjectTab } from "@web/components/shell/project-tabs/visible-tabs";

export interface ProjectGroupChipProps {
  name: string;
  collapsed: boolean;
  hiddenTabs: ProjectTab[];
  onToggle: () => void;
}

export function ProjectGroupChip({ name, collapsed, hiddenTabs, onToggle }: ProjectGroupChipProps) {
  const attention = hiddenTabs.reduce((sum, tab) => sum + (tab.attention ?? 0), 0);
  const tags = [...new Set(hiddenTabs.flatMap((tab) => (tab.tag === undefined ? [] : [tab.tag])))];
  const summary = [
    hiddenTabs.length > 0 ? `${hiddenTabs.length} hidden` : null,
    tags.length > 0 ? `on ${tags.join(", ")}` : null,
    attention > 0 ? `${attention} unread` : null,
  ].filter((part) => part !== null);
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-label={[`${name} group`, ...summary].join(", ")}
      className={cn(
        "flex h-7 flex-none items-center gap-1.5 rounded-md px-1.5 text-sm font-medium text-text-secondary hover:bg-hover",
        FOCUS_RING_INSET,
      )}
    >
      <Icon name={collapsed ? "chevron-right" : "chevron-down"} size="xs" aria-hidden />
      <span className="max-w-32 truncate">{name}</span>
      {hiddenTabs.length > 0 ? (
        <span className="text-text-tertiary">+{hiddenTabs.length}</span>
      ) : null}
      {tags.map((tag) => (
        <HostTag key={tag} tag={tag} />
      ))}
      {attention > 0 ? <Badge variant="warning">{attention}</Badge> : null}
    </button>
  );
}
