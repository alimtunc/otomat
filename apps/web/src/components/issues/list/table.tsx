import { useTable } from "@tanstack/react-table";
import { ISSUE_COLUMNS } from "@web/components/issues/list/columns";
import { IssueGroupSection } from "@web/components/issues/list/group-section";
import { TableHead } from "@web/components/table/head";
import { TableRow } from "@web/components/table/row";
import type { IssueGroup } from "@web/lib/issue/grouping";
import { rowSlices, TABLE, TABLE_FEATURES } from "@web/lib/table";
import { useMemo } from "react";

export interface IssuesTableProps {
  groups: IssueGroup[];
  showGroupHeadings: boolean;
  collapsed: string[];
  onToggleGroup: (key: string) => void;
}

export function IssuesTable({
  groups,
  showGroupHeadings,
  collapsed,
  onToggleGroup,
}: IssuesTableProps) {
  const issues = useMemo(() => groups.flatMap((group) => group.issues), [groups]);
  const table = useTable({ features: TABLE_FEATURES, columns: ISSUE_COLUMNS, data: issues });
  const sections = rowSlices(
    table.getRowModel().rows,
    groups.map((group) => group.issues.length),
  );

  return (
    <table className={TABLE}>
      <TableHead table={table} />
      {groups.map((group, index) => {
        const folded = showGroupHeadings && collapsed.includes(group.key);
        return (
          <IssueGroupSection
            key={group.key}
            group={group}
            heading={showGroupHeadings}
            columnCount={ISSUE_COLUMNS.length}
            collapsed={folded}
            onToggle={onToggleGroup}
          >
            {folded ? null : sections[index].map((row) => <TableRow key={row.id} row={row} />)}
          </IssueGroupSection>
        );
      })}
    </table>
  );
}
