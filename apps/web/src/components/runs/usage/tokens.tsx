import type { ReportedUsageContract } from "@otomat/domain";
import { cn } from "@otomat/ui";
import { formatCostUsd, formatTokenCount } from "@web/lib/run/usage";
import { USAGE_PROVENANCE } from "@web/lib/run/usage-provenance";

export interface UsageTokensProps {
  usage: ReportedUsageContract;
  showProvenance?: boolean;
  className?: string;
}

export function UsageTokens({ usage, showProvenance = true, className }: UsageTokensProps) {
  if (usage.availability === "unavailable") {
    return <span className={cn("text-xs text-text-tertiary", className)}>Not reported</span>;
  }
  const parts: string[] = [];
  if (usage.input_tokens !== null) parts.push(`in ${formatTokenCount(usage.input_tokens)}`);
  if (usage.output_tokens !== null) parts.push(`out ${formatTokenCount(usage.output_tokens)}`);
  if (usage.cost_usd !== null) parts.push(formatCostUsd(usage.cost_usd));
  return (
    <span className={cn("flex items-center gap-1.5", className)}>
      <span className="font-mono text-xs tabular-nums text-text-secondary">
        {parts.length === 0 ? "reported without figures" : parts.join(" · ")}
      </span>
      {showProvenance ? (
        <span className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary">
          {USAGE_PROVENANCE[usage.availability]}
        </span>
      ) : null}
    </span>
  );
}
