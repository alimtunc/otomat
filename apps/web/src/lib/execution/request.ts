import {
  selectsOneAgent,
  type AgentSelection,
  type ExecutionOptionSelections,
  type ModelSelection,
} from "@otomat/domain";
import { agentChoiceToRequest, type AgentRequestFields } from "@web/lib/agent/choice";

import type { ExecutionSelection } from "./selection";

export interface ExecutionRequestFields extends AgentRequestFields {
  model?: ModelSelection;
  options?: ExecutionOptionSelections;
}

export function executionRequestFields(selection: ExecutionSelection): ExecutionRequestFields {
  const fields: ExecutionRequestFields = { ...agentChoiceToRequest(selection.agent) };
  if (selection.model !== undefined) fields.model = selection.model;
  if (Object.keys(selection.options).length > 0) fields.options = selection.options;
  return fields;
}

export function agentSelectionFields(
  fields: ExecutionRequestFields,
): (ExecutionRequestFields & AgentSelection) | null {
  return selectsOneAgent(fields) ? fields : null;
}
