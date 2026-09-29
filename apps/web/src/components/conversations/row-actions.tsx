import { isConversationFollowed, type ConversationThreadEntry } from "@otomat/domain";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Icon,
  IconButton,
} from "@otomat/ui";
import { userTerminalsAvailable } from "@web/api/terminals/client";
import { EndSessionDialog } from "@web/components/terminal/end-session-dialog";
import { isConversationRunning } from "@web/lib/conversations/status";
import type { InboxMarkPatch } from "@web/lib/inbox/marks";
import { useRef, useState } from "react";

export function ConversationRowActions({
  entry,
  pending,
  onMark,
}: {
  entry: ConversationThreadEntry;
  pending: boolean;
  onMark: (patch: InboxMarkPatch) => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [ending, setEnding] = useState(false);
  const terminal = "terminal" in entry ? entry.terminal : null;
  const endable = terminal !== null && isConversationRunning(entry) && userTerminalsAvailable();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          ref={trigger}
          disabled={pending}
          render={
            <IconButton
              size="sm"
              label="Conversation actions"
              icon={<Icon name="more-horizontal" aria-hidden />}
              className="mr-1 self-center text-text-tertiary"
            />
          }
        />
        <DropdownMenuContent align="end">
          {isConversationFollowed(entry) ? (
            <DropdownMenuItem disabled={pending} onClick={() => onMark({ read: !entry.read })}>
              {entry.read ? "Mark as unread" : "Mark as read"}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem disabled={pending} onClick={() => onMark({ archived: true })}>
            Archive
          </DropdownMenuItem>
          {endable ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setEnding(true)}>
                <Icon name="square" aria-hidden />
                End session…
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {ending && terminal !== null ? (
        <EndSessionDialog
          sessionId={terminal.id}
          finalFocus={trigger}
          onClose={() => setEnding(false)}
        />
      ) : null}
    </>
  );
}
