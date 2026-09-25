import type { TerminalTool } from "@otomat/domain";

const TERMINAL_TOOL_LABELS = {
  claude: "Claude",
  codex: "Codex",
} satisfies Record<TerminalTool, string>;

export function terminalToolLabel(tool: TerminalTool | null): string {
  return tool === null ? "Shell" : TERMINAL_TOOL_LABELS[tool];
}
