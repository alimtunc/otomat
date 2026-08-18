import { useTable } from "@tanstack/react-table";
import { WORKSPACE_COLUMNS } from "@web/components/settings/workspaces/columns";
import { WorkspaceRepositorySection } from "@web/components/settings/workspaces/repository-group";
import { TableHead } from "@web/components/table/head";
import { TableRow } from "@web/components/table/row";
import { rowSlices, TABLE, TABLE_FEATURES } from "@web/lib/table";
import type { WorkspaceRepositoryGroup } from "@web/lib/workspace/filter";

export function WorkspacesTable({ groups }: { groups: WorkspaceRepositoryGroup[] }) {
  const table = useTable({
    features: TABLE_FEATURES,
    columns: WORKSPACE_COLUMNS,
    data: groups.flatMap((group) => group.entries),
  });
  const sections = rowSlices(
    table.getRowModel().rows,
    groups.map((group) => group.entries.length),
  );

  return (
    <table className={TABLE}>
      <TableHead table={table} />
      {groups.map((group, index) => (
        <WorkspaceRepositorySection
          key={group.repositoryId}
          group={group}
          columnCount={WORKSPACE_COLUMNS.length}
        >
          {sections[index].map((row) => (
            <TableRow key={row.id} row={row} />
          ))}
        </WorkspaceRepositorySection>
      ))}
    </table>
  );
}
