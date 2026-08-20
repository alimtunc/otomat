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

/** `ready` and `done` are reachable directly from every other state but `canceled`: the operator owns the source status and may close or reopen the work wherever execution left it. */
export const issueMachine = defineMachine<IssueState>({
  name: "issue",
  initial: "backlog",
  transitions: {
    backlog: ["ready", "done", "canceled"],
    ready: ["running", "blocked", "done", "canceled"],
    running: ["reviewing", "blocked", "ready", "done", "canceled"],
    reviewing: ["running", "pr_open", "blocked", "ready", "done", "canceled"],
    pr_open: ["reviewing", "ready", "done", "canceled"],
    blocked: ["ready", "running", "done", "canceled"],
    done: ["ready"],
    canceled: [],
  },
});

/** The states an operator may set by hand; the execution ones are projections of a real run and would read as a fabricated state. */
export const MANUAL_ISSUE_STATES = ["ready", "done"] as const satisfies readonly IssueState[];
export type ManualIssueState = (typeof MANUAL_ISSUE_STATES)[number];

export function manualIssueTargets(from: IssueState): readonly ManualIssueState[] {
  return MANUAL_ISSUE_STATES.filter((state) => issueMachine.canTransition(from, state));
}

/** The two ends of the issue's work: it is closed, so no local run speaks for it any more until an operator reopens it. */
export const ISSUE_CLOSED_STATES = ["done", "canceled"] as const satisfies readonly IssueState[];
export type IssueClosedState = (typeof ISSUE_CLOSED_STATES)[number];

const issueClosedSet: ReadonlySet<string> = new Set(ISSUE_CLOSED_STATES);

export function isIssueClosed(status: string): status is IssueClosedState {
  return issueClosedSet.has(status);
}
