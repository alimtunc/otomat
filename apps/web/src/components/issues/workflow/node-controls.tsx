import type { ModelSelection } from "@otomat/domain";
import { Button, cn } from "@otomat/ui";
import { LaunchAgentSelect } from "@web/components/runs/launch/launch-agent-select";
import { ModelSelect } from "@web/components/runs/launch/model-select";
import type { LaunchAgentChoice } from "@web/components/runs/launch/use-launch-agent-choice";
import { agentChoiceRuntimeId } from "@web/lib/agent-choice";
import { AGENT_MODEL_LABEL, RUN_MODEL_LABEL } from "@web/lib/model-choice";
import type { WorkflowNodeDraft } from "@web/lib/workflow-draft";

/** The agent and model of one plan node, each defaulting to the run-level choice. */
export function NodeAgentFields({
  agents,
  label,
  agent,
  model,
  onAgentChange,
  onModelChange,
}: {
  agents: LaunchAgentChoice;
  label: string;
  agent: string | null;
  model: ModelSelection | undefined;
  onAgentChange: (agent: string | null) => void;
  onModelChange: (model: ModelSelection | undefined) => void;
}) {
  // A node without its own agent runs on the run default, so that is the runtime whose models it lists.
  const runtimeId = agentChoiceRuntimeId(agent ?? agents.choice, agents.profiles);
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <div className="w-52 min-w-0">
        <LaunchAgentSelect
          profiles={agents.profiles}
          descriptors={agents.descriptors}
          value={agent}
          onValueChange={onAgentChange}
          includeDefault
          ariaLabel={`${label} agent`}
        />
      </div>
      <div className="w-52 min-w-0">
        <ModelSelect
          compact
          runtimeId={runtimeId}
          value={model}
          onValueChange={onModelChange}
          inheritLabel={agent === null ? RUN_MODEL_LABEL : AGENT_MODEL_LABEL}
          ariaLabel={`${label} model`}
        />
      </div>
    </div>
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
