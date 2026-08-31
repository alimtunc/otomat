import { usageTokenMetric, type UsageFilters } from "@otomat/domain";
import { cn } from "@otomat/ui";
import { UsageMetricValue } from "@web/components/usage/metric-value";
import { formatExactTokenCount, formatTokenCount } from "@web/lib/run/usage";
import {
  isUsageRowSelected,
  usageRowSummary,
  type UsageBreakdownRow,
} from "@web/lib/usage/breakdown";

export interface UsageBreakdownProps {
  title: string;
  rows: UsageBreakdownRow[];
  filters: UsageFilters;
  emptyLabel: string;
  onSelect: (row: UsageBreakdownRow) => void;
}

export function UsageBreakdown({
  title,
  rows,
  filters,
  emptyLabel,
  onSelect,
}: UsageBreakdownProps) {
  const peak = Math.max(...rows.map((row) => usageTokenMetric(row.figures).value ?? 0), 1);

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-1.5 px-4.5 py-3">
      <h2 className="text-xs font-medium text-text-tertiary">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-text-tertiary">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((row) => {
            const tokens = usageTokenMetric(row.figures);
            const selected = isUsageRowSelected(filters, row);
            return (
              <li key={row.key}>
                <button
                  type="button"
                  aria-pressed={selected}
                  aria-label={usageRowSummary(row)}
                  onClick={() => onSelect(row)}
                  className={cn(
                    "flex w-full min-w-0 items-center gap-3 rounded-sm px-1.5 py-1 text-left hover:bg-hover",
                    selected && "bg-selected",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-sm">{row.label}</span>
                  <span className="h-1.5 w-24 shrink-0 rounded-full bg-surface-2">
                    <span
                      className={cn(
                        "block h-full rounded-full",
                        selected ? "bg-iris" : "bg-iris-subtle",
                      )}
                      style={{
                        width: tokens.value === null ? 0 : `${(tokens.value / peak) * 100}%`,
                      }}
                    />
                  </span>
                  <UsageMetricValue
                    metric={tokens}
                    turns={row.figures.turns}
                    format={formatTokenCount}
                    exact={formatExactTokenCount}
                    className="w-20 shrink-0 justify-end text-xs"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
