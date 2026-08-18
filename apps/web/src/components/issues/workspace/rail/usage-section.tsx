import { useRunUsage } from "@web/api/runs/queries";
import {
  RailMeta,
  RailRow,
  RailSection,
} from "@web/components/issues/workspace/rail/rail-primitives";
import { Unknown } from "@web/components/issues/workspace/rail/unknown";
import { UsageTokens } from "@web/components/runs/usage/tokens";
import { USAGE_PROVENANCE } from "@web/lib/run/usage-provenance";

function UsageTotal({ usage }: { usage: ReturnType<typeof useRunUsage> }) {
  if (usage.data !== undefined) {
    return <UsageTokens usage={usage.data.total} showProvenance={false} />;
  }
  if (!usage.isError) return <Unknown />;
  return (
    <button
      type="button"
      className="text-xs text-text-tertiary underline"
      onClick={() => void usage.refetch()}
    >
      Usage could not be read — retry
    </button>
  );
}

export function UsageSection({ runId }: { runId: string }) {
  const usage = useRunUsage(runId);
  const total = usage.data?.total;
  const provenance = (): string => {
    if (total !== undefined) return USAGE_PROVENANCE[total.availability];
    return usage.isError ? "unreadable" : "loading";
  };
  return (
    <RailSection
      title={
        <>
          Usage
          <span className="font-normal normal-case text-text-tertiary">· {provenance()}</span>
        </>
      }
    >
      <RailMeta>
        <RailRow label="Run total">
          <UsageTotal usage={usage} />
        </RailRow>
        <RailRow label="Turns reported">
          {total === undefined ? (
            <Unknown />
          ) : (
            <span className="font-mono text-xs tabular-nums text-text-secondary">
              {total.turns}
            </span>
          )}
        </RailRow>
      </RailMeta>
      <p className="mt-2 text-xs leading-relaxed text-text-tertiary">
        Summed over the turns the runtime reported — nothing is estimated.
      </p>
    </RailSection>
  );
}
