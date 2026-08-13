import type { IssueContract, IssueSource } from "@otomat/domain";
import { IssueSourceGlyph } from "@otomat/ui";
import type { TableCellProps } from "@web/lib/table";

export function IssueSourceCell({ getValue }: TableCellProps<IssueContract, IssueSource>) {
  const source = getValue();
  return (
    <span className="flex items-center gap-1.5">
      <IssueSourceGlyph source={source} />
      {source}
    </span>
  );
}
