import { usageMetricState, type UsageMetric } from "@otomat/domain";
import { cn } from "@otomat/ui";

export interface UsageMetricValueProps {
  metric: UsageMetric;
  turns: number;
  format: (value: number) => string;
  className?: string;
}

export function UsageMetricValue({ metric, turns, format, className }: UsageMetricValueProps) {
  const state = usageMetricState(metric, turns);
  if (metric.value === null || state === "unavailable") {
    return <span className={cn("text-xs text-text-tertiary", className)}>Not reported</span>;
  }
  return (
    <span className={cn("inline-flex items-baseline gap-1.5", className)}>
      <span className="font-mono tabular-nums text-foreground">{format(metric.value)}</span>
      {state === "partial" ? (
        <span
          className="text-[10px] uppercase tracking-[0.06em] text-warning"
          title={`${metric.reported_turns} of ${turns} turns reported this figure`}
        >
          partial
        </span>
      ) : null}
    </span>
  );
}
