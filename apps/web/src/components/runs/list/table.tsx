import { useTable } from "@tanstack/react-table";
import { RUN_COLUMNS } from "@web/components/runs/list/columns";
import { RunIssueGroupSection } from "@web/components/runs/list/issue-group";
import { TableHead } from "@web/components/table/head";
import { TableRow } from "@web/components/table/row";
import type { RunIssueGroup } from "@web/lib/run/grouping";
import { rowSlices, TABLE, TABLE_FEATURES } from "@web/lib/table";

export function RunsTable({ groups }: { groups: RunIssueGroup[] }) {
  const table = useTable({
    features: TABLE_FEATURES,
    columns: RUN_COLUMNS,
    data: groups.flatMap((group) => group.runs),
  });
  const sections = rowSlices(
    table.getRowModel().rows,
    groups.map((group) => group.runs.length),
  );

  return (
    <table className={TABLE}>
      <TableHead table={table} />
      {groups.map((group, index) => (
        <RunIssueGroupSection key={group.issueId} group={group} columnCount={RUN_COLUMNS.length}>
          {sections[index].map((row) => (
            <TableRow key={row.id} row={row} />
          ))}
        </RunIssueGroupSection>
      ))}
    </table>
  );
}
