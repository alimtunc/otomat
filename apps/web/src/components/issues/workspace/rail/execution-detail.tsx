import { Button, Collapsible, CollapsiblePanel, CollapsibleTrigger, Icon } from "@otomat/ui";
import { Mono } from "@web/components/issues/workspace/rail/mono";
import { ProvenanceValue } from "@web/components/issues/workspace/rail/provenance-value";
import { RailMeta, RailRow } from "@web/components/issues/workspace/rail/rail-primitives";
import { Unknown } from "@web/components/issues/workspace/rail/unknown";
import { providerOptionKeyLabel } from "@web/lib/provider-option-labels";
import type { FrozenExecution } from "@web/lib/run/frozen-execution";

export interface ExecutionDetailProps {
  executions: FrozenExecution[];
  reported: string | null;
}

export function ExecutionDetail({ executions, reported }: ExecutionDetailProps) {
  const perStep = new Set(executions.map((execution) => execution.configHash)).size > 1;

  return (
    <Collapsible className="group/execution mt-2.5">
      <CollapsibleTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="-mx-1.75 w-full justify-start text-text-tertiary"
          />
        }
      >
        <Icon
          name="chevron-down"
          aria-hidden
          className="group-data-[closed]/execution:-rotate-90"
        />
        Execution details
      </CollapsibleTrigger>
      <CollapsiblePanel className="pt-2">
        {perStep
          ? executions.map((execution) => (
              <div key={execution.id} className="mb-2.5 last:mb-0">
                <p className="mb-1.5 text-xs font-medium text-text-secondary">{execution.name}</p>
                <RailMeta>
                  <RailRow label="Agent">
                    <ProvenanceValue
                      value={execution.runtime.label}
                      source={execution.runtime.source}
                    />
                  </RailRow>
                  <RailRow label="Model">
                    <ProvenanceValue
                      value={execution.model.label}
                      source={execution.model.source}
                    />
                  </RailRow>
                  {execution.options.map((option) => (
                    <RailRow key={option.key} label={providerOptionKeyLabel(option.key)}>
                      <ProvenanceValue value={option.label} source={option.source} />
                    </RailRow>
                  ))}
                </RailMeta>
              </div>
            ))
          : null}
        <RailMeta>
          <RailRow label="Reported">
            {reported === null ? <Unknown /> : <Mono>{reported}</Mono>}
          </RailRow>
        </RailMeta>
        <p className="mt-2 text-xs leading-relaxed text-text-tertiary">
          This is what the run froze at launch, and exactly what a resume or a follow-up replays —
          never the preferences as they stand now. Reported is only what the runtime said it used.
        </p>
      </CollapsiblePanel>
    </Collapsible>
  );
}
