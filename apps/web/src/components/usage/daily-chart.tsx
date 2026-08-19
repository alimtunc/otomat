import { usageTokenMetric, type UsageFilters } from "@otomat/domain";
import { cn } from "@otomat/ui";
import {
  isUsageRowSelected,
  usageRowSummary,
  type UsageBreakdownRow,
} from "@web/lib/usage/breakdown";
import { formatUsageDay } from "@web/lib/usage/format";

export interface UsageDailyChartProps {
  rows: UsageBreakdownRow[];
  filters: UsageFilters;
  onSelect: (row: UsageBreakdownRow) => void;
}

/** A day that reported turns but no figure still gets a mark: absent is not the same as none. */
const UNREPORTED_HEIGHT = "3px";

function barClass(magnitude: number | null, selected: boolean): string {
  if (magnitude === null) return "bg-border-strong";
  return selected ? "bg-iris" : "bg-iris-subtle hover:bg-iris";
}

export function UsageDailyChart({ rows, filters, onSelect }: UsageDailyChartProps) {
  const peak = Math.max(...rows.map((row) => usageTokenMetric(row.figures).value ?? 0), 1);
  const first = rows[0];
  const last = rows.at(-1);

  return (
    <section className="flex flex-col gap-2 border-b border-border-subtle px-4.5 py-3">
      <h2 className="text-xs font-medium text-text-tertiary">Tokens per day (UTC)</h2>
      <div className="flex h-24 items-end gap-0.5">
        {rows.map((row) => {
          const magnitude = usageTokenMetric(row.figures).value;
          const selected = isUsageRowSelected(filters, row);
          return (
            <button
              key={row.key}
              type="button"
              aria-pressed={selected}
              aria-label={usageRowSummary(row)}
              title={usageRowSummary(row)}
              onClick={() => onSelect(row)}
              className="flex h-full min-w-1 flex-1 items-end rounded-xs hover:bg-hover"
            >
              <span
                className={cn("w-full rounded-xs", barClass(magnitude, selected))}
                style={{
                  height:
                    magnitude === null
                      ? UNREPORTED_HEIGHT
                      : `${Math.max((magnitude / peak) * 100, 2)}%`,
                }}
              />
            </button>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-text-tertiary">
        <span>{first === undefined ? null : formatUsageDay(first.key)}</span>
        <span>{last === undefined ? null : formatUsageDay(last.key)}</span>
      </div>
    </section>
  );
}
