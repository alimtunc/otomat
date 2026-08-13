import type { RunContract } from "@otomat/domain";
import { useRunEventStream } from "@web/api/runs/run-event-stream";
import { Mono } from "@web/components/issues/workspace/rail/mono";
import {
  RailMeta,
  RailRow,
  RailSection,
} from "@web/components/issues/workspace/rail/rail-primitives";
import { Unknown } from "@web/components/issues/workspace/rail/unknown";
import { providerOptionKeyLabel } from "@web/lib/provider-option-labels";
import { frozenRunExecutions, type FrozenExecutionValue } from "@web/lib/run/frozen-execution";
import { latestReportedUsage } from "@web/lib/run/usage";

function FrozenRow({ label, value }: { label: string; value: FrozenExecutionValue }) {
  return (
    <RailRow label={label}>
      <Mono>{value.label}</Mono>
      {value.source === null ? null : (
        <span className="text-xs text-text-tertiary">{value.source}</span>
      )}
    </RailRow>
  );
}

/** Separate rows on purpose: a request is not evidence, so a provider that reports nothing stays empty rather than echoing the request back. */
export function ExecutionSection({ run }: { run: RunContract }) {
  const stream = useRunEventStream();
  const reported = latestReportedUsage(stream.events)?.model ?? null;
  const frozen = frozenRunExecutions(run.plan_json);

  return (
    <RailSection title="Execution">
      {frozen.length === 0 ? (
        <RailMeta>
          <RailRow label="Requested">
            <Unknown />
          </RailRow>
        </RailMeta>
      ) : (
        frozen.map((execution) => (
          <RailMeta key={execution.key}>
            <FrozenRow label="Agent" value={execution.runtime} />
            <FrozenRow label="Model" value={execution.model} />
            {execution.options.map((option) => (
              <FrozenRow
                key={option.key}
                label={providerOptionKeyLabel(option.key)}
                value={option}
              />
            ))}
          </RailMeta>
        ))
      )}
      <RailMeta>
        <RailRow label="Reported">
          {reported === null ? <Unknown /> : <Mono>{reported}</Mono>}
        </RailRow>
      </RailMeta>
      <p className="mt-2 text-xs leading-relaxed text-text-tertiary">
        This is what the run froze at launch, and exactly what a resume or a follow-up replays —
        never the preferences as they stand now. Reported is only what the runtime said it used.
      </p>
    </RailSection>
  );
}
