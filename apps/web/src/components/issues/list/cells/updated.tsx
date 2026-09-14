import type { IssueSummary } from "@otomat/domain";
import { RelativeTime } from "@otomat/ui";
import { Unknown } from "@web/components/issues/workspace/rail/unknown";
import type { TableCellProps } from "@web/lib/table";

export function IssueUpdatedCell({ getValue }: TableCellProps<IssueSummary, string | null>) {
  const synced = getValue();
  return synced === null ? <Unknown /> : <RelativeTime date={synced} addSuffix={false} />;
}
