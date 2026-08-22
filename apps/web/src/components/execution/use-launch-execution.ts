import {
  useLaunchAgentChoice,
  type LaunchAgentChoice,
} from "@web/components/runs/launch/use-launch-agent-choice";
import type { AgentScope } from "@web/lib/agent-choice";
import { executionRequestFields, type ExecutionRequestFields } from "@web/lib/execution/request";
import type { ExecutionSelection } from "@web/lib/execution/selection";
import { isCompleteModelSelection } from "@web/lib/model-choice";

export interface LaunchExecution {
  agents: LaunchAgentChoice;
  /** The selection with its agent resolved to something launchable. */
  selection: ExecutionSelection;
  request: ExecutionRequestFields;
  /** False while no runtime is launchable or a typed model identifier is not one the daemon would accept. */
  canLaunch: boolean;
}

export function useLaunchExecution(
  preferred: ExecutionSelection,
  scope: AgentScope = "all",
): LaunchExecution {
  const agents = useLaunchAgentChoice(preferred.agent, scope);
  const selection = { ...preferred, agent: agents.choice };
  return {
    agents,
    selection,
    request: executionRequestFields(selection),
    canLaunch: agents.choice !== null && isCompleteModelSelection(selection.model),
  };
}
