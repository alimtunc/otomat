import { defineMachine } from "./machine.js";

export const AGENT_SESSION_STATES = [
  "created",
  "active",
  "idle",
  "awaiting_input",
  "terminated",
  "failed",
] as const;

export type AgentSessionState = (typeof AGENT_SESSION_STATES)[number];

export const agentSessionMachine = defineMachine<AgentSessionState>({
  name: "agent_session",
  initial: "created",
  transitions: {
    created: ["active", "terminated", "failed"],
    active: ["idle", "awaiting_input", "terminated", "failed"],
    idle: ["active", "terminated", "failed"],
    awaiting_input: ["active", "terminated", "failed"],
    terminated: [],
    failed: [],
  },
});
