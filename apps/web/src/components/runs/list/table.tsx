import { useTable } from "@tanstack/react-table";
import { RUN_COLUMNS } from "@web/components/runs/list/columns";
import { RunIssueGroupSection } from "@web/components/runs/list/issue-group";
import { VirtualTable } from "@web/components/table/virtual-table";
import type { RunIssueGroup } from "@web/lib/run/grouping";
import { rowSlices, TABLE_FEATURES } from "@web/lib/table";
import { useMemo } from "react";

export function RunsTable({
  groups,
  scrollId = "runs-list",
}: {
  groups: RunIssueGroup[];
  scrollId?: string;
}) {
  const runs = useMemo(() => groups.flatMap((group) => group.runs), [groups]);
  const table = useTable({ features: TABLE_FEATURES, columns: RUN_COLUMNS, data: runs });
  const sections = rowSlices(
    table.getRowModel().rows,
    groups.map((group) => group.runs.length),
  );

  return (
    <VirtualTable
      table={table}
      columnCount={RUN_COLUMNS.length}
      scrollId={scrollId}
      groups={groups.map((group, index) => ({
        key: group.issueId,
        header: <RunIssueGroupSection group={group} />,
        rows: sections[index],
      }))}
    />
  );
}
