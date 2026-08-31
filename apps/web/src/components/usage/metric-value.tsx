import { usageMetricState, type UsageMetric } from "@otomat/domain";
import { cn, Icon } from "@otomat/ui";

const partialMessage = (metric: UsageMetric, turns: number): string =>
  `Partial: ${metric.reported_turns} of ${turns} turns reported this figure`;

export interface UsageMetricValueProps {
  metric: UsageMetric;
  turns: number;
  format: (value: number) => string;
  exact?: (value: number) => string;
  className?: string;
}

export function UsageMetricValue({
  metric,
  turns,
  format,
  exact,
  className,
}: UsageMetricValueProps) {
  const state = usageMetricState(metric, turns);
  if (metric.value === null || state === "unavailable") {
    return <span className={cn("text-xs text-text-tertiary", className)}>Not reported</span>;
  }
  return (
    <span className={cn("inline-flex items-baseline gap-1", className)}>
      <span
        className="font-mono tabular-nums text-foreground"
        title={exact === undefined ? undefined : exact(metric.value)}
      >
        {format(metric.value)}
      </span>
      {state === "partial" ? (
        <span className="self-center text-warning" title={partialMessage(metric, turns)}>
          <Icon name="info" role="img" aria-label={partialMessage(metric, turns)} size="xs" />
        </span>
      ) : null}
    </span>
  );
}
