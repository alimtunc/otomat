import type { RunContract } from "@otomat/domain";
import { useRunEventStream } from "@web/api/runs/run-event-stream";
import {
  RailMeta,
  RailRow,
  RailSection,
} from "@web/components/issues/workspace/rail/rail-primitives";
import { Unknown } from "@web/components/issues/workspace/rail/unknown";
import { requestedRunModels, resolvedModelLabel } from "@web/lib/model-choice";
import { latestReportedUsage } from "@web/lib/run/usage";
import type { ReactNode } from "react";

function Mono({ children }: { children: ReactNode }) {
  return <span className="truncate font-mono text-xs text-text-secondary">{children}</span>;
}

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
