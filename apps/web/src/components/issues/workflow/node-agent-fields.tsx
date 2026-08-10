import type { EffortSelection, ModelSelection } from "@otomat/domain";
import { EffortSelect } from "@web/components/runs/launch/effort-select";
import { LaunchAgentSelect } from "@web/components/runs/launch/launch-agent-select";
import { ModelSelect } from "@web/components/runs/launch/model-select";
import type { LaunchAgentChoice } from "@web/components/runs/launch/use-launch-agent-choice";
import { agentChoiceProfile, agentChoiceRuntimeId } from "@web/lib/agent-choice";
import { agentEffort, resolveNodeEffort, type ResolvedEffort } from "@web/lib/effort-choice";
import { AGENT_MODEL_LABEL, effectiveModelId, RUN_MODEL_LABEL } from "@web/lib/model-choice";

export interface NodeAgentFieldsProps {
  agents: LaunchAgentChoice;
  label: string;
  agent: string | null;
  model: ModelSelection | undefined;
  effort: EffortSelection | undefined;
  /** The level the run itself resolves to, which every inheriting node follows. */
  runEffort: ResolvedEffort;
  /** The model the run resolves to, so a node inheriting both gets the levels published for it. */
  runModelId: string | null;
  onAgentChange: (agent: string | null) => void;
  onModelChange: (model: ModelSelection | undefined) => void;
  onEffortChange: (effort: EffortSelection | undefined) => void;
}

/** The agent, model and effort of one plan node, each defaulting to the run-level choice. */
export function NodeAgentFields({
  agents,
  label,
  agent,
  model,
  effort,
  runEffort,
  runModelId,
  onAgentChange,
  onModelChange,
  onEffortChange,
}: NodeAgentFieldsProps) {
  const choice = agent ?? agents.choice;
  const runtimeId = agentChoiceRuntimeId(choice, agents.profiles);
  const profile = agentChoiceProfile(choice, agents.profiles);
  const modelId = effectiveModelId(model, agent === null ? runModelId : (profile?.model ?? null));

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
      <div className="min-w-0">
        <EffortSelect
          compact
          offerRun
          runtimeId={runtimeId}
          modelId={modelId}
          value={effort}
          onValueChange={onEffortChange}
          resolved={resolveNodeEffort(effort, runEffort, agentEffort(profile))}
          ariaLabel={`${label} effort`}
        />
      </div>
    </div>
  );
}
