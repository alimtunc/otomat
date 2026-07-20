import { defineMachine } from "./machine.js";

export const ISSUE_STATES = [
  "backlog",
  "ready",
  "running",
  "reviewing",
  "pr_open",
  "blocked",
  "done",
  "canceled",
] as const;

export type IssueState = (typeof ISSUE_STATES)[number];

export const issueMachine = defineMachine<IssueState>({
  name: "issue",
  initial: "backlog",
  transitions: {
    backlog: ["ready", "canceled"],
    ready: ["running", "blocked", "canceled"],
    running: ["reviewing", "blocked", "canceled"],
    reviewing: ["running", "pr_open", "blocked", "canceled"],
    pr_open: ["reviewing", "done", "canceled"],
    blocked: ["ready", "running", "canceled"],
    done: [],
    canceled: [],
  },
});

/**
 * Linear's `WorkflowState.type` vocabulary. The personalizable state *name* is
 * never an identity; only the type is comparable across teams.
 */
export const LINEAR_ISSUE_STATE_TYPES = [
  "triage",
  "backlog",
  "unstarted",
  "started",
  "completed",
  "canceled",
  "duplicate",
] as const;
export type LinearIssueStateType = (typeof LINEAR_ISSUE_STATE_TYPES)[number];

const LINEAR_ISSUE_STATES: Record<LinearIssueStateType, IssueState> = {
  triage: "backlog",
  backlog: "backlog",
  unstarted: "ready",
  started: "running",
  completed: "done",
  canceled: "canceled",
  duplicate: "canceled",
};

const LINEAR_ISSUE_STATE_LOOKUP = new Map<string, IssueState>(Object.entries(LINEAR_ISSUE_STATES));

/**
 * Projects a Linear workflow state type onto the local issue status. A mirrored
 * issue takes its status from the source rather than transitioning locally, and
 * Linear may add a type without breaking the schema, so unknown types land in
 * `backlog` instead of throwing.
 */
export function issueStateFromLinear(stateType: string): IssueState {
  return LINEAR_ISSUE_STATE_LOOKUP.get(stateType) ?? "backlog";
}
