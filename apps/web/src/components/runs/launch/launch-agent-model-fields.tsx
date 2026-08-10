import type { ModelSelection } from "@otomat/domain";
import { LaunchAgentPicker } from "@web/components/runs/launch/launch-agent-picker";
import { ModelSelect } from "@web/components/runs/launch/model-select";
import type { LaunchAgentChoice } from "@web/components/runs/launch/use-launch-agent-choice";
import { agentChoiceRuntimeId } from "@web/lib/agent-choice";
import { AGENT_MODEL_LABEL } from "@web/lib/model-choice";

export interface LaunchAgentModelFieldsProps {
  agents: LaunchAgentChoice;
  model: ModelSelection | undefined;
  onAgentChoice: (choice: string | null) => void;
  onModelChange: (model: ModelSelection | undefined) => void;
  modelAriaLabel?: string;
}

/** The model only means anything against a runtime, so it stays beside its agent and hides while nothing is launchable. */
export function LaunchAgentModelFields({
  agents,
  model,
  onAgentChoice,
  onModelChange,
  modelAriaLabel = "Model",
}: LaunchAgentModelFieldsProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1">
        <LaunchAgentPicker
          agents={agents}
          onValueChange={(choice) => {
            onModelChange(undefined);
            onAgentChoice(choice);
          }}
        />
      </div>
      {agents.choice === null ? null : (
        <div className="min-w-0 flex-[2]">
          <ModelSelect
            runtimeId={agentChoiceRuntimeId(agents.choice, agents.profiles)}
            value={model}
            onValueChange={onModelChange}
            inheritLabel={AGENT_MODEL_LABEL}
            ariaLabel={modelAriaLabel}
          />
        </div>
      )}
    </div>
  );
}
