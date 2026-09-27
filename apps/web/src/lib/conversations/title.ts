import type { ConversationThreadEntry } from "@otomat/domain";
import { terminalToolLabel } from "@web/lib/terminal-tool";

export function conversationTitle(entry: ConversationThreadEntry): string {
  return "terminal" in entry
    ? `${terminalToolLabel(entry.terminal.tool)} terminal`
    : entry.step_name;
}
