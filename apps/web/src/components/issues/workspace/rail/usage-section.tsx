import { useRunEventStream } from "@web/api/runs/run-events-provider";
import {
  RailMeta,
  RailRow,
  RailSection,
  Unknown,
} from "@web/components/issues/workspace/rail/rail-primitives";
import { formatCostUsd, formatTokenCount, latestReportedUsage } from "@web/lib/run-usage";

export function UsageSection() {
  const stream = useRunEventStream();
  const usage = latestReportedUsage(stream.events);
  return (
    <RailSection
      title={
        <>
          Usage
          <span className="font-normal text-text-tertiary">· last reported</span>
        </>
      }
      last
    >
      <RailMeta>
        <RailRow label="Model">
          {usage?.model != null ? (
            <span className="truncate font-mono text-xs text-text-secondary">{usage.model}</span>
          ) : (
            <Unknown />
          )}
        </RailRow>
        <RailRow label="Input">
          {usage?.inputTokens != null ? (
            <span className="font-mono text-xs tabular-nums text-text-secondary">
              {formatTokenCount(usage.inputTokens)}
            </span>
          ) : (
            <Unknown />
          )}
        </RailRow>
        <RailRow label="Output">
          {usage?.outputTokens != null ? (
            <span className="font-mono text-xs tabular-nums text-text-secondary">
              {formatTokenCount(usage.outputTokens)}
            </span>
          ) : (
            <Unknown />
          )}
        </RailRow>
        <RailRow label="Cost">
          {usage?.costUsd != null ? (
            <span className="font-mono text-xs tabular-nums text-text-secondary">
              {formatCostUsd(usage.costUsd)}
            </span>
          ) : (
            <Unknown />
          )}
        </RailRow>
      </RailMeta>
      <p className="mt-2 text-xs leading-relaxed text-text-tertiary">
        Only what the runtime actually reported — nothing is estimated.
      </p>
    </RailSection>
  );
}
