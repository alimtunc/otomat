import { useTable } from "@tanstack/react-table";
import { ISSUE_COLUMNS } from "@web/components/issues/list/columns";
import { IssueGroupSection } from "@web/components/issues/list/group-section";
import { VirtualTable } from "@web/components/table/virtual-table";
import type { IssueGroup } from "@web/lib/issue/grouping";
import type { IssueOptionalColumn } from "@web/lib/issue/view-config";
import { rowSlices, TABLE_FEATURES } from "@web/lib/table";
import { useMemo } from "react";

export interface IssuesTableProps {
  groups: IssueGroup[];
  scrollId?: string;
  optionalColumns?: IssueOptionalColumn[];
  showGroupHeadings: boolean;
  collapsed: string[];
  onToggleGroup: (key: string) => void;
}

export function IssuesTable({
  groups,
  optionalColumns = [],
  showGroupHeadings,
  collapsed,
  onToggleGroup,
  scrollId = "issues-list",
}: IssuesTableProps) {
  const issues = useMemo(() => groups.flatMap((group) => group.issues), [groups]);
  const hideStatus =
    showGroupHeadings &&
    groups.every(
      (group) =>
        group.status !== null && group.issues.every((issue) => issue.status === group.status),
    );
  const showSource = optionalColumns.includes("source");
  const showAssignee = optionalColumns.includes("assignee");
  const columns = useMemo(
    () =>
      ISSUE_COLUMNS.filter((column) => {
        if (column.id === "status") return !hideStatus;
        if (column.id === "source") return showSource;
        if (column.id === "assignee") return showAssignee;
        return true;
      }),
    [hideStatus, showSource, showAssignee],
  );
  const table = useTable({ features: TABLE_FEATURES, columns, data: issues });
  const sections = rowSlices(
    table.getRowModel().rows,
    groups.map((group) => group.issues.length),
  );

  return (
    <VirtualTable
      table={table}
      columnCount={columns.length}
      scrollId={scrollId}
      groups={groups.map((group, index) => ({
        key: group.key,
        header: showGroupHeadings ? (
          <IssueGroupSection
            group={group}
            collapsed={collapsed.includes(group.key)}
            onToggle={onToggleGroup}
          />
        ) : null,
        rows: showGroupHeadings && collapsed.includes(group.key) ? [] : sections[index],
      }))}
    />
  );
}
