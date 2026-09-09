import {
  SUPERVISION_DEFAULT_MAX_LOOPS,
  SUPERVISION_MAX_LOOPS_LIMIT,
  type SupervisionRequest,
} from "@otomat/domain";
import { agentSelectionFields, executionRequestFields } from "@web/lib/execution/request";
import type { ExecutionSelection } from "@web/lib/execution/selection";

export interface SupervisionDraft {
  execution: ExecutionSelection;
  /** Kept as typed text so an empty field stays empty rather than collapsing to a number. */
  maxLoops: string;
  budgetUsd: string;
}

export const EMPTY_SUPERVISION_LIMITS = {
  maxLoops: String(SUPERVISION_DEFAULT_MAX_LOOPS),
  budgetUsd: "",
};

function positiveNumber(value: string): number | null {
  const parsed = Number(value.trim());
  return value.trim() !== "" && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function supervisionRoundsError({ value }: { value: string }): string | undefined {
  const rounds = Number(value.trim());
  return value.trim() !== "" &&
    Number.isInteger(rounds) &&
    rounds >= 1 &&
    rounds <= SUPERVISION_MAX_LOOPS_LIMIT
    ? undefined
    : `Enter a whole number of rounds between 1 and ${SUPERVISION_MAX_LOOPS_LIMIT}.`;
}

export function supervisionBudgetError({ value }: { value: string }): string | undefined {
  if (value.trim() === "" || positiveNumber(value) !== null) return undefined;
  return "Enter a budget above 0, or leave it empty for uncapped.";
}

/** Naming a supervisor agent is what supervises the workflow; there is no separate switch to leave inconsistent with it. */
export function supervisionRequest(draft: SupervisionDraft): SupervisionRequest | null {
  const agent = agentSelectionFields(executionRequestFields(draft.execution));
  if (agent === null) return null;
  return {
    ...agent,
    max_loops: positiveNumber(draft.maxLoops) ?? SUPERVISION_DEFAULT_MAX_LOOPS,
    budget_usd: positiveNumber(draft.budgetUsd),
  };
}
