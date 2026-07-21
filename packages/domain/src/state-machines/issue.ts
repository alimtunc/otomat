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
