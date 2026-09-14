import { FOCUS_RING, Icon } from "@otomat/ui";
import { CountBadge } from "@web/components/issues/count-badge";
import { BoardCard } from "@web/components/issues/list/board-card";
import { IssueGroupHeading } from "@web/components/issues/list/group-heading";
import { useVirtualList } from "@web/components/virtual-list/use-virtual-list";
import type { IssueGroup } from "@web/lib/issue/grouping";

export function IssueBoardColumn({
  group,
  heading,
  collapsed,
  onToggle,
  scrollId,
}: {
  group: IssueGroup;
  heading: boolean;
  collapsed: boolean;
  onToggle: (key: string) => void;
  scrollId: string;
}) {
  const { virtualizer, containerProps } = useVirtualList({
    id: scrollId,
    count: collapsed ? 0 : group.issues.length,
    getItemKey: (index) => group.issues[index].id,
    estimateSize: () => 140,
  });
  return (
    <section aria-label={group.label} className="flex h-full min-h-0 flex-col gap-2">
      {heading ? (
        <header className="flex h-8 shrink-0 items-center px-1 text-sm font-medium text-foreground">
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-controls={encodeURIComponent(scrollId)}
            onClick={() => onToggle(group.key)}
            className={`flex min-w-0 flex-1 items-center gap-2 rounded-sm ${FOCUS_RING}`}
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
        </header>
      ) : null}
      <div
        {...containerProps}
        id={encodeURIComponent(scrollId)}
        className="min-h-0 flex-1 overflow-auto"
      >
        <ul className="relative" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((item) => (
            <BoardCard
              key={item.key}
              issue={group.issues[item.index]}
              ref={virtualizer.measureElement}
              data-index={item.index}
              data-virtual-index={item.index}
              aria-setsize={group.issues.length}
              aria-posinset={item.index + 1}
              className="absolute top-0 left-0 w-full pb-2"
              style={{ transform: `translateY(${item.start}px)` }}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}
