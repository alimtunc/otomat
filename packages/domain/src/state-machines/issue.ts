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

/** The two ends of the machine: the tracker has closed the issue, so no local run speaks for it any more. */
export const ISSUE_TERMINAL_STATES = ["done", "canceled"] as const satisfies readonly IssueState[];
export type IssueTerminalState = (typeof ISSUE_TERMINAL_STATES)[number];

const issueTerminalSet: ReadonlySet<string> = new Set(ISSUE_TERMINAL_STATES);

export function isIssueTerminal(status: string): status is IssueTerminalState {
  return issueTerminalSet.has(status);
}
