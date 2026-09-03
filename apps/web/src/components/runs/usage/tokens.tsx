import type { ReportedUsageContract } from "@otomat/domain";
import { cn } from "@otomat/ui";
import { formatCostUsd, formatExactTokenCount, formatTokenCount } from "@web/lib/run/usage";
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
  const exactParts: string[] = [];
  if (usage.input_tokens !== null) {
    parts.push(`in\u00a0${formatTokenCount(usage.input_tokens)}`);
    exactParts.push(`in ${formatExactTokenCount(usage.input_tokens)}`);
  }
  if (usage.output_tokens !== null) {
    parts.push(`out\u00a0${formatTokenCount(usage.output_tokens)}`);
    exactParts.push(`out ${formatExactTokenCount(usage.output_tokens)}`);
  }
  if (usage.cost_usd !== null) parts.push(formatCostUsd(usage.cost_usd));
  const marker = USAGE_PROVENANCE[usage.availability];
  return (
    <span className={cn("flex flex-wrap items-center gap-x-1.5", className)}>
      <span
        className="font-mono text-xs tabular-nums text-text-secondary"
        title={exactParts.length === 0 ? undefined : exactParts.join(" · ")}
      >
        {parts.length === 0 ? "reported without figures" : parts.join(" · ")}
      </span>
      {showProvenance && marker !== null ? (
        <span className="text-micro text-text-tertiary">{marker}</span>
      ) : null}
    </span>
  );
}
