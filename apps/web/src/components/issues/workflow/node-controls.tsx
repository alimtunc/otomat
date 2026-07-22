import type { AgentProfileContract, RuntimeDescriptor } from "@otomat/domain";
import { Button, cn } from "@otomat/ui";
import { LaunchAgentSelect } from "@web/components/runs/launch/launch-agent-select";
import type { WorkflowNodeDraft } from "@web/lib/workflow-plan";

export function StepAgentSelect({
  profiles,
  descriptors,
  label,
  value,
  onValueChange,
}: {
  profiles: AgentProfileContract[];
  descriptors: RuntimeDescriptor[];
  label: string;
  value: string | null;
  onValueChange: (agent: string | null) => void;
}) {
  return (
    <LaunchAgentSelect
      profiles={profiles}
      descriptors={descriptors}
      value={value}
      onValueChange={onValueChange}
      includeDefault
      ariaLabel={label}
    />
  );
}

export function DependencyToggles({
  earlier,
  dependsOn,
  onToggle,
}: {
  earlier: WorkflowNodeDraft[];
  dependsOn: string[];
  onToggle: (key: string) => void;
}) {
  if (earlier.length === 0) {
    return <span className="text-xs text-text-tertiary">Runs first</span>;
  }
  const dependsOnSet = new Set(dependsOn);
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-xs text-text-tertiary">After:</span>
      {earlier.map((candidate, candidateIndex) => {
        const selected = dependsOnSet.has(candidate.key);
        return (
          <Button
            key={candidate.key}
            type="button"
            variant="outline"
            size="xs"
            aria-pressed={selected}
            className={cn(
              selected
                ? "border-iris/40 bg-iris-subtle text-iris-text hover:bg-iris-subtle"
                : "text-text-secondary",
            )}
            onClick={() => onToggle(candidate.key)}
          >
            {candidate.kind === "compete" ? "Winner of " : ""}
            {candidate.name.trim() || `Step ${candidateIndex + 1}`}
          </Button>
        );
      })}
    </div>
  );
}
