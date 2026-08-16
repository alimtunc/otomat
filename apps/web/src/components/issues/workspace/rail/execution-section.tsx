import type { RunContract } from "@otomat/domain";
import { useRunEventStream } from "@web/api/runs/run-event-stream";
import { ExecutionDetail } from "@web/components/issues/workspace/rail/execution-detail";
import { Mono } from "@web/components/issues/workspace/rail/mono";
import { ProvenanceValue } from "@web/components/issues/workspace/rail/provenance-value";
import {
  RailMeta,
  RailRow,
  RailSection,
} from "@web/components/issues/workspace/rail/rail-primitives";
import { Unknown } from "@web/components/issues/workspace/rail/unknown";
import { providerOptionKeyLabel } from "@web/lib/provider-option-labels";
import { frozenRunExecutions } from "@web/lib/run/frozen-execution";
import { activeStepRunId } from "@web/lib/run/plan";
import { latestReportedUsage } from "@web/lib/run/usage";

export function ExecutionSection({ run }: { run: RunContract }) {
  const stream = useRunEventStream();
  const executions = frozenRunExecutions(run.plan_json);
  const activeId = activeStepRunId(stream.events);
  const selected = executions.find((execution) => execution.id === activeId) ?? executions[0];
  // Run-wide usage would credit one step's model to another as soon as the plan has two.
  const stepEvents = stream.events.filter((event) => event.step_run_id === selected?.id);
  const reported = latestReportedUsage(stepEvents)?.model ?? null;
  const diverged = reported !== null && reported !== selected?.model.label;

  return (
    <RailSection
      title={
        <>
          Execution
          {selected === undefined ? null : (
            <span className="truncate font-normal normal-case text-text-tertiary">
              · {selected.name}
            </span>
          )}
        </>
      }
    >
      {selected === undefined ? (
        <RailMeta>
          <RailRow label="Requested">
            <Unknown />
          </RailRow>
        </RailMeta>
      ) : (
        <RailMeta>
          <RailRow label="Agent">
            <ProvenanceValue value={selected.runtime.label} source={selected.runtime.source} />
          </RailRow>
          <RailRow label="Model">
            <ProvenanceValue value={selected.model.label} source={selected.model.source} />
          </RailRow>
          {selected.options.map((option) => (
            <RailRow key={option.key} label={providerOptionKeyLabel(option.key)}>
              <ProvenanceValue value={option.label} source={option.source} />
            </RailRow>
          ))}
          {diverged ? (
            <RailRow label="Reported">
              <Mono>{reported}</Mono>
            </RailRow>
          ) : null}
        </RailMeta>
      )}
      <ExecutionDetail executions={executions} reported={reported} />
    </RailSection>
  );
}
