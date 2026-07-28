import type { RunContract } from "@otomat/domain";
import { useRunEventStream } from "@web/api/runs/run-events-provider";
import {
  Mono,
  RailMeta,
  RailRow,
  RailSection,
  Unknown,
} from "@web/components/issues/workspace/rail/rail-primitives";
import { requestedRunModels, resolvedModelLabel } from "@web/lib/model-choice";
import { latestReportedUsage } from "@web/lib/run/usage";

/** Separate rows on purpose: a request is not evidence, so a provider that reports nothing stays empty rather than echoing the request back. */
export function ModelSection({ run }: { run: RunContract }) {
  const stream = useRunEventStream();
  const reported = latestReportedUsage(stream.events)?.model ?? null;
  const requested = requestedRunModels(run.plan_json);

  return (
    <RailSection title="Model">
      <RailMeta>
        {requested.length === 0 ? (
          <RailRow label="Requested">
            <Unknown />
          </RailRow>
        ) : (
          requested.map((model, index) => (
            <RailRow
              key={model === null ? `default-${index}` : `${model.source}:${model.id}`}
              label={index === 0 ? "Requested" : ""}
            >
              <Mono>{resolvedModelLabel(model)}</Mono>
            </RailRow>
          ))
        )}
        <RailRow label="Reported">
          {reported === null ? <Unknown /> : <Mono>{reported}</Mono>}
        </RailRow>
      </RailMeta>
      <p className="mt-2 text-xs leading-relaxed text-text-tertiary">
        Requested is what this run froze at launch. Reported is only what the runtime said it used.
      </p>
    </RailSection>
  );
}
