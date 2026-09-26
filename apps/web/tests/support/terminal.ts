import type { TerminalSession } from "@otomat/domain";

export const TERMINAL_INSTANCE = "00000000-0000-4000-8000-000000000001";

export function terminalSession(overrides: Partial<TerminalSession> = {}): TerminalSession {
  return {
    id: "00000000-0000-4000-8000-000000000002",
    issue_id: "i1",
    project_id: "p1",
    worktree_id: "w1",
    path: "/tmp/worktree",
    branch: "feat/demo",
    started_at: "2026-09-25T00:00:00Z",
    tool: null,
    state: "running",
    exit_code: null,
    signal: null,
    ...overrides,
  };
}
