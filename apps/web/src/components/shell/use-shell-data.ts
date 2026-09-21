import {
  countActionablePullRequestInboxEntries,
  countUnreadConversations,
  countUnreadInboxEntries,
} from "@otomat/domain";
import { useConversations } from "@web/api/conversations/queries";
import { useDaemonStatus } from "@web/api/daemon/queries";
import { useInbox } from "@web/api/inbox/queries";
import { usePullRequestInbox } from "@web/api/reviews/queries";
import { useProjectRuns } from "@web/api/runs/queries";
import { useProjectSwitcher } from "@web/components/shell/project-selection/use-project-switcher";
import { useRemoteSession } from "@web/components/shell/remote-session/context";
import { remoteStatusHeadline } from "@web/components/shell/remote-session/status-labels";
import { isRunning } from "@web/lib/run/filters";

export function useShellData() {
  const { connectionState, lastSyncAt, retry } = useDaemonStatus();
  const switcher = useProjectSwitcher();
  const runs = useProjectRuns(switcher.currentProjectId);
  const reviewInbox = usePullRequestInbox(switcher.currentProjectId);
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
    hasLiveRun: (runs.data ?? []).some(isRunning),
    reviewCount: countActionablePullRequestInboxEntries(reviewInbox.data?.entries ?? []),
    inboxCount: countUnreadInboxEntries(inbox.data?.entries ?? []),
    conversationCount: countUnreadConversations(conversations.data?.entries ?? []),
  };
}
