import type { UsageRunRow } from "@otomat/domain";
import { UsageMetricValue } from "@web/components/usage/metric-value";
import { formatCostUsd } from "@web/lib/run/usage";
import type { TableCellProps } from "@web/lib/table";

export function UsageCostCell({ row }: TableCellProps<UsageRunRow>) {
  return (
    <UsageMetricValue
      metric={row.original.figures.cost_usd}
      turns={row.original.figures.turns}
      format={formatCostUsd}
      className="text-xs"
    />
  );
}
