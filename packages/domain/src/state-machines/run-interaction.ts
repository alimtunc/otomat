import { defineMachine } from "./machine.js";

/** What a runtime can block a turn on: an allow/deny gate, a pick among options it listed, a free answer it asked for, or several questions it takes together. */
export const RUN_INTERACTION_KINDS = ["permission", "choice", "text", "questionnaire"] as const;
export type RunInteractionKind = (typeof RUN_INTERACTION_KINDS)[number];

export const RUN_INTERACTION_STATES = ["pending", "answered", "canceled"] as const;
export type RunInteractionState = (typeof RUN_INTERACTION_STATES)[number];

/** Both settled states are ends: a runtime asks once per request, so a second answer would reach a turn that already moved on. */
export const runInteractionMachine = defineMachine<RunInteractionState>({
  name: "run_interaction",
  initial: "pending",
  transitions: {
    pending: ["answered", "canceled"],
    answered: [],
    canceled: [],
  },
});
