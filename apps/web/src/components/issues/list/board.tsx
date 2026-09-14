import { IssueBoardColumn } from "@web/components/issues/list/board-column";
import { useVirtualList } from "@web/components/virtual-list/use-virtual-list";
import type { IssueGroup } from "@web/lib/issue/grouping";

export interface IssuesBoardProps {
  groups: IssueGroup[];
  showGroupHeadings: boolean;
  collapsed: string[];
  onToggleGroup: (key: string) => void;
  scrollId?: string;
}

export function IssuesBoard({
  groups,
  showGroupHeadings,
  collapsed,
  onToggleGroup,
  scrollId = "issues-board",
}: IssuesBoardProps) {
  const { virtualizer, containerProps } = useVirtualList({
    id: scrollId,
    count: groups.length,
    getItemKey: (index) => groups[index].key,
    estimateSize: () => 314,
    horizontal: true,
  });
  return (
    <div {...containerProps} className="h-full overflow-x-auto px-4.5 py-4">
      <div className="relative h-full" style={{ width: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const group = groups[item.index];
          return (
            <div
              key={group.key}
              data-virtual-index={item.index}
              className="absolute top-0 h-full w-75"
              style={{ left: item.start }}
            >
              <IssueBoardColumn
                group={group}
                heading={showGroupHeadings}
                collapsed={showGroupHeadings && collapsed.includes(group.key)}
                onToggle={onToggleGroup}
                scrollId={`${scrollId}:${group.key}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
