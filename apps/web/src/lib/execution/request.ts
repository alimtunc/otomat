import type { ExecutionOptionSelections, ModelSelection } from "@otomat/domain";
import { agentChoiceToRequest, type AgentRequestFields } from "@web/lib/agent-choice";

import type { ExecutionSelection } from "./selection";

export interface ExecutionRequestFields extends AgentRequestFields {
  model?: ModelSelection;
  options?: ExecutionOptionSelections;
}

export function executionRequestFields(selection: ExecutionSelection): ExecutionRequestFields {
  return {
    ...agentChoiceToRequest(selection.agent),
    ...(selection.model === undefined ? {} : { model: selection.model }),
    ...(Object.keys(selection.options).length === 0 ? {} : { options: selection.options }),
  };
}
