import { FOCUS_RING, Icon } from "@otomat/ui";
import { CountBadge } from "@web/components/issues/count-badge";
import { BoardCard } from "@web/components/issues/list/board-card";
import { IssueGroupHeading } from "@web/components/issues/list/group-heading";
import type { IssueGroup } from "@web/lib/issue/grouping";

export interface IssuesBoardProps {
  groups: IssueGroup[];
  showGroupHeadings: boolean;
  collapsed: string[];
  onToggleGroup: (key: string) => void;
}

export function IssuesBoard({
  groups,
  showGroupHeadings,
  collapsed,
  onToggleGroup,
}: IssuesBoardProps) {
  return (
    <div className="grid h-full auto-cols-[300px] grid-flow-col items-start gap-3.5 overflow-x-auto px-4.5 py-4">
      {groups.map((group) => {
        const folded = showGroupHeadings && collapsed.includes(group.key);
        const cardsId = `board-group-${group.key}`;
        return (
          <section key={group.key} aria-label={group.label} className="flex min-h-0 flex-col gap-2">
            {showGroupHeadings ? (
              <header className="flex h-8 items-center px-1 text-sm font-medium text-foreground">
                <button
                  type="button"
                  aria-expanded={!folded}
                  aria-controls={cardsId}
                  onClick={() => onToggleGroup(group.key)}
                  className={`flex min-w-0 flex-1 items-center gap-2 rounded-sm ${FOCUS_RING}`}
                >
                  <Icon
                    name="chevron-down"
                    size="xs"
                    aria-hidden
                    className={folded ? "-rotate-90 text-text-tertiary" : "text-text-tertiary"}
                  />
                  <IssueGroupHeading group={group} />
                  <CountBadge count={group.issues.length} tone="neutral" />
                </button>
              </header>
            ) : null}
            <ul id={cardsId} className="flex flex-col gap-2">
              {folded
                ? null
                : group.issues.map((issue) => <BoardCard key={issue.id} issue={issue} />)}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
