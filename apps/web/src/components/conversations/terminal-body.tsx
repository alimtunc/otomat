import type { TerminalSession } from "@otomat/domain";
import { EmptyState } from "@otomat/ui";
import { userTerminalsAvailable } from "@web/api/terminals/client";
import { TerminalReader } from "@web/components/conversations/terminal-reader";
import { CenteredState } from "@web/components/shell/centered-state";

export function TerminalConversationBody({ session }: { session: TerminalSession }) {
  if (!userTerminalsAvailable())
    return (
      <CenteredState>
        <EmptyState
          icon="terminal"
          title="Terminal session"
          description="User terminals are available in the desktop app."
        />
      </CenteredState>
    );
  return <TerminalReader session={session} />;
}
