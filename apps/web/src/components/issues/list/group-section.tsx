import { FOCUS_RING, Icon } from "@otomat/ui";
import { CountBadge } from "@web/components/issues/count-badge";
import { IssueGroupHeading } from "@web/components/issues/list/group-heading";
import type { IssueGroup } from "@web/lib/issue/grouping";
import { GROUP_HEAD_CELL } from "@web/lib/table";
import type { ReactNode } from "react";

export interface IssueGroupSectionProps {
  group: IssueGroup;
  heading: boolean;
  columnCount: number;
  collapsed: boolean;
  onToggle: (key: string) => void;
  children: ReactNode;
}

export function IssueGroupSection({
  group,
  heading,
  columnCount,
  collapsed,
  onToggle,
  children,
}: IssueGroupSectionProps) {
  const rowsId = `issue-group-${group.key}`;
  return (
    <>
      {heading ? (
        <tbody>
          <tr>
            <th scope="colgroup" colSpan={columnCount} className={GROUP_HEAD_CELL}>
              <button
                type="button"
                aria-expanded={!collapsed}
                aria-controls={rowsId}
                onClick={() => onToggle(group.key)}
                className={`flex h-8 w-full items-center gap-2 px-3 text-sm font-medium text-foreground ${FOCUS_RING} focus-visible:outline-offset-[-2px]`}
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
            </th>
          </tr>
        </tbody>
      ) : null}
      <tbody id={rowsId}>{children}</tbody>
    </>
  );
}
