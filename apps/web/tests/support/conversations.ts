import type { ConversationEntry, TerminalConversationEntry } from "@otomat/domain";

const UPDATED_AT = "2026-09-19T10:00:00.000Z";

export function conversationEntry(overrides: Partial<ConversationEntry> = {}): ConversationEntry {
  return {
    id: "conversation:step-1",
    project: { id: "p1", name: "Otomat" },
    issue: { id: "issue-1", identifier: "OTO-1", title: "Ship it", cycle: "running" },
    run_id: "run-1",
    run_status: "running",
    step_run_id: "step-1",
    step_name: "Implement",
    step_status: "running",
    participant: { runtime: "claude", profile_name: "Implementer", model: "opus", effort: "high" },
    last: { kind: "agent", text: "Root cause found.", at: UPDATED_AT },
    pending_interaction: null,
    queued_contributions: 0,
    updated_at: UPDATED_AT,
    read: false,
    archived: false,
    ...overrides,
  };
}

export function terminalConversationEntry(
  overrides: Partial<TerminalConversationEntry> = {},
): TerminalConversationEntry {
  return {
    id: "terminal:00000000-0000-4000-8000-000000000002",
    project: { id: "p1", name: "Otomat" },
    issue: null,
    terminal: {
      id: "00000000-0000-4000-8000-000000000002",
      project_id: "p1",
      issue_id: null,
      worktree_id: null,
      path: "/tmp/otomat",
      branch: "main",
      tool: "codex",
      started_at: UPDATED_AT,
      state: "exited",
      exit_code: 0,
      signal: null,
    },
    updated_at: UPDATED_AT,
    read: false,
    archived: false,
    ...overrides,
  };
}
