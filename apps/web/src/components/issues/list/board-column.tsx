import { FOCUS_RING } from "@otomat/ui";
import { BoardCard } from "@web/components/issues/list/board-card";
import { IssueGroupToggle } from "@web/components/issues/list/group-toggle";
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
        <header className="flex h-8 shrink-0 items-center px-1">
          <IssueGroupToggle
            group={group}
            collapsed={collapsed}
            onToggle={onToggle}
            controls={encodeURIComponent(scrollId)}
            className={`min-w-0 flex-1 rounded-sm ${FOCUS_RING}`}
          />
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
