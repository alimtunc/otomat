import { useRunEventStream } from "@web/api/runs/run-event-stream";
import {
  RailMeta,
  RailRow,
  RailSection,
} from "@web/components/issues/workspace/rail/rail-primitives";
import { Unknown } from "@web/components/issues/workspace/rail/unknown";
import { formatCostUsd, formatTokenCount, latestReportedUsage } from "@web/lib/run/usage";

export function UsageSection() {
  const stream = useRunEventStream();
  const usage = latestReportedUsage(stream.events);
  return (
    <RailSection
      title={
        <>
          Usage
          <span className="font-normal normal-case text-text-tertiary">· last reported</span>
        </>
      }
    >
      <RailMeta>
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
