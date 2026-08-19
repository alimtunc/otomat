import type { UsageRunRow } from "@otomat/domain";
import type { TableCellProps } from "@web/lib/table";
import { usageEmitterLabel } from "@web/lib/usage/facets";

export function UsageEmittersCell({ row }: TableCellProps<UsageRunRow>) {
  const labels = row.original.emitters.map(usageEmitterLabel);
  const [first, ...rest] = labels;
  if (first === undefined) return <span className="text-xs text-text-tertiary">Not reported</span>;
  return (
    <span className="flex min-w-0 items-center gap-1.5" title={labels.join(", ")}>
      <span className="truncate text-text-secondary">{first}</span>
      {rest.length === 0 ? null : (
        <span className="shrink-0 text-xs text-text-tertiary">+{rest.length}</span>
      )}
    </span>
  );
}
