import type { ExecutionOptionSelections, ModelSelection } from "@otomat/domain";
import { agentChoiceToRequest, type AgentRequestFields } from "@web/lib/agent-choice";

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

export interface ProfileRequestFields {
  profile_id: string;
  model?: ModelSelection;
  options?: ExecutionOptionSelections;
}

/** The same fields for a request that only accepts a saved profile; null while the picker has not resolved one. */
export function profileRequestFields(fields: ExecutionRequestFields): ProfileRequestFields | null {
  if (fields.profile_id === undefined) return null;
  const request: ProfileRequestFields = { profile_id: fields.profile_id };
  if (fields.model) request.model = fields.model;
  if (fields.options) request.options = fields.options;
  return request;
}
