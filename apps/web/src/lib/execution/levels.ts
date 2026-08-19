import {
  EMPTY_EXECUTION_DEFAULTS,
  executionLevels,
  overrideLevel,
  type AgentProfileContract,
  type ExecutionDefaults,
  type ExecutionLevel,
  type ExecutionOverrides,
} from "@otomat/domain";

import type { ExecutionPickerLevel, ExecutionSelection } from "./selection";

export interface ExecutionLevelsInput {
  level: ExecutionPickerLevel;
  own: ExecutionSelection;
  /** The run's own overrides, applied only while this surface keeps the run's agent. */
  inherited?: ExecutionOverrides;
  /** Whether this surface still resolves through the run: false once it names its own agent. */
  inheritsAgent: boolean;
  profile: AgentProfileContract | null;
  defaults: ExecutionDefaults | undefined;
  /** The runtime the effective agent resolves on; null while nothing is chosen. */
  runtimeId: string | null;
}

function ownLevel(level: ExecutionPickerLevel, own: ExecutionSelection): ExecutionLevel {
  const result: ExecutionLevel = {
    source: level,
    agent: level === "profile" || level === "global",
    options: own.options,
  };
  if (own.model !== undefined) result.model = own.model;
  return result;
}

/** A surface never sits under itself: editing a profile puts the host defaults directly beneath it, and editing the host defaults leaves nothing beneath at all. */
export function pickerLevels(input: ExecutionLevelsInput): ExecutionLevel[] {
  const overrides = [ownLevel(input.level, input.own)];
  if (input.level === "step" && input.inheritsAgent && input.inherited) {
    overrides.push(overrideLevel("launch", input.inherited));
  }
  if (input.runtimeId === null || input.level === "global") return overrides;
  return executionLevels(
    overrides,
    input.level === "profile" ? null : input.profile,
    input.defaults ?? EMPTY_EXECUTION_DEFAULTS,
    input.runtimeId,
  );
}
