import { countUnreadInboxEntries } from "@otomat/domain";
import { useConversations } from "@web/api/conversations/queries";
import { useDaemonStatus } from "@web/api/daemon/queries";
import { useInbox } from "@web/api/inbox/queries";
import { useProjectSwitcher } from "@web/components/shell/project-selection/use-project-switcher";
import { useRemoteSession } from "@web/components/shell/remote-session/context";
import { remoteStatusHeadline } from "@web/components/shell/remote-session/status-labels";

export function useShellData() {
  const { connectionState, lastSyncAt, retry } = useDaemonStatus();
  const switcher = useProjectSwitcher();
  const inbox = useInbox();
  const conversations = useConversations();
  const remote = useRemoteSession();

  return {
    // A settling host's health poll fails for a 20–30s bootstrap: progress, not a dead daemon.
    connectionState: remote.settling ? ("reconnecting" as const) : connectionState,
    connectionLabel:
      remote.settling && remote.status !== null
        ? remoteStatusHeadline(remote.status, remote.alias)
        : undefined,
    lastSyncAt,
    retry,
    ...switcher,
    conversations,
    inboxCount: countUnreadInboxEntries(inbox.data?.entries ?? []),
  };
}
