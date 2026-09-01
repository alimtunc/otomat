import type { UsageRunRow } from "@otomat/domain";
import { UsageMetricValue } from "@web/components/usage/metric-value";
import { formatExactTokenCount, formatTokenCount } from "@web/lib/run/usage";
import type { TableCellProps } from "@web/lib/table";

export function UsageTokensCell({ row }: TableCellProps<UsageRunRow>) {
  const { figures } = row.original;
  return (
    <span className="flex items-baseline justify-end gap-2 text-xs">
      <UsageMetricValue
        metric={figures.input_tokens}
        turns={figures.turns}
        format={(value) => `${formatTokenCount(value)} in`}
        exact={formatExactTokenCount}
      />
      <span aria-hidden className="text-text-tertiary">
        ·
      </span>
      <UsageMetricValue
        metric={figures.output_tokens}
        turns={figures.turns}
        format={(value) => `${formatTokenCount(value)} out`}
        exact={formatExactTokenCount}
      />
    </span>
  );
}
