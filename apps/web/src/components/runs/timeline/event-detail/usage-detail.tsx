import type { EventEnvelope } from "@otomat/domain";
import { formatCostUsd, formatTokenCount, parseReportedUsage } from "@web/lib/run-usage";

export function UsageDetail({ event }: { event: EventEnvelope }) {
  const usage = parseReportedUsage(event.payload);
  if (usage === null) return null;
  const parts: string[] = [];
  if (usage.inputTokens !== null) parts.push(`in ${formatTokenCount(usage.inputTokens)}`);
  if (usage.outputTokens !== null) parts.push(`out ${formatTokenCount(usage.outputTokens)}`);
  if (usage.costUsd !== null) parts.push(formatCostUsd(usage.costUsd));
  if (usage.model !== null) parts.push(usage.model);
  if (parts.length === 0) return null;
  return (
    <span className="mt-1 inline-flex items-center rounded-full border border-border-subtle bg-surface-1 px-2.5 py-0.5 font-mono text-xs text-text-secondary">
      {parts.join(" · ")}
    </span>
  );
}
