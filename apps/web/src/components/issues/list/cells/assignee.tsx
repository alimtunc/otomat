import type { IssueContract } from "@otomat/domain";
import { Avatar } from "@otomat/ui";
import { Unknown } from "@web/components/issues/workspace/rail/unknown";
import type { TableCellProps } from "@web/lib/table";

export function IssueAssigneeCell({ getValue }: TableCellProps<IssueContract, string | null>) {
  const name = getValue();
  if (name === null) return <Unknown />;
  return (
    <span className="flex items-center gap-1.5 text-text-secondary">
      <Avatar name={name} size="sm" />
      <span className="truncate">{name}</span>
    </span>
  );
}
