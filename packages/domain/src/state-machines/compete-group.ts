import { defineMachine } from "./machine.js";

export const COMPETE_GROUP_STATES = [
  "queued",
  "running",
  "awaiting_human",
  "awaiting_selection",
  "promoting",
  "selected",
  "failed",
  "canceled",
] as const;

export type CompeteGroupState = (typeof COMPETE_GROUP_STATES)[number];

export const competeGroupMachine = defineMachine<CompeteGroupState>({
  name: "compete_group",
  initial: "queued",
  transitions: {
    queued: ["running", "failed", "canceled"],
    running: ["awaiting_human", "awaiting_selection", "failed", "canceled"],
    awaiting_human: ["running", "awaiting_selection", "failed", "canceled"],
    awaiting_selection: ["promoting", "canceled"],
    promoting: ["selected", "failed"],
    selected: [],
    failed: [],
    canceled: [],
  },
});
