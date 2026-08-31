import type { TableCellProps } from "@web/lib/table";
import type { WorkspaceRow } from "@web/lib/workspace/row";

export function WorkspacePullRequestCell({ row }: TableCellProps<WorkspaceRow, unknown>) {
  const pullRequest = row.original.pull_request;
  if (pullRequest === null) return <span className="text-text-tertiary">—</span>;
  const label = `#${pullRequest.number ?? "?"}${pullRequest.merged ? " merged" : ""}`;
  if (pullRequest.url === null) return <span className="text-text-secondary">{label}</span>;
  return (
    <a href={pullRequest.url} target="_blank" rel="noreferrer" className="text-iris-text underline">
      {label}
    </a>
  );
}
