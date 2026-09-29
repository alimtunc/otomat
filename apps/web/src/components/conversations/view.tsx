import type { ConversationThreadEntry } from "@otomat/domain";
import { EmptyState } from "@otomat/ui";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { useMarkConversations } from "@web/api/conversations/mutations";
import { useConversations } from "@web/api/conversations/queries";
import { useConversationsStream } from "@web/api/conversations/use-conversations-stream";
import { useMarkConversationSeen } from "@web/api/conversations/use-mark-seen";
import { RunEventsProvider } from "@web/api/runs/run-events-provider";
import { useDaemonToken } from "@web/api/use-daemon-token";
import { ConversationFiltersMenu } from "@web/components/conversations/filters-menu";
import { ConversationList } from "@web/components/conversations/list";
import { TerminalConversationBody } from "@web/components/conversations/terminal-body";
import { ConversationThreadBody } from "@web/components/conversations/thread-body";
import { ErrorReport } from "@web/components/diagnostics/error-report";
import { CenteredState } from "@web/components/shell/centered-state";
import { ListSkeleton } from "@web/components/shell/list-skeleton";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { RouteShell } from "@web/components/shell/route-shell";
import { activeHost, activeHostStore } from "@web/lib/active-host";
import {
  activeConversationFilterCount,
  applyConversationFilters,
  conversationProjectOptions,
  NO_CONVERSATION_FILTERS,
} from "@web/lib/conversations/filters";
import { findConversationThread } from "@web/lib/conversations/find-thread";
import { groupConversations } from "@web/lib/conversations/sections";
import { conversationTitle } from "@web/lib/conversations/title";
import { markInboxRequest, type InboxMarkPatch } from "@web/lib/inbox/marks";
import { useState, type ReactNode } from "react";

export function ConversationsView() {
  useConversationsStream();
  const conversations = useConversations();
  const hostUrl = useSelector(
    activeHostStore,
    (state) => state?.daemonUrl ?? activeHost().daemonUrl,
  );
  const token = useDaemonToken();
  const mark = useMarkConversations();
  const { run, step, terminal } = useSearch({ from: "/conversations" });
  const navigate = useNavigate();
  const [filters, setFilters] = useState(NO_CONVERSATION_FILTERS);
  const filtered = activeConversationFilterCount(filters) > 0;

  const entries = conversations.data?.entries ?? [];
  const selected = findConversationThread(entries, { step, terminal });
  useMarkConversationSeen(terminal === undefined ? null : { terminal });

  const markEntry = (entry: ConversationThreadEntry, patch: InboxMarkPatch): void => {
    mark.mutate(markInboxRequest([entry], patch));
  };
  const closeThread = (): void => {
    void navigate({ to: "/conversations", search: {}, replace: true });
  };

  const list = (
    <QueryBoundary
      query={conversations}
      pending={<ListSkeleton rows={8} height={40} />}
      error={
        <ErrorReport
          error={conversations.error}
          context="Couldn’t load the conversations"
          onRetry={() => void conversations.refetch()}
        />
      }
    >
      {(data) => {
        const sections = groupConversations(applyConversationFilters(data.entries, filters));
        return sections.length === 0 ? (
          <CenteredState>
            <EmptyState
              icon="message-square"
              title={filtered ? "No conversation matches these filters" : "No conversations yet"}
              description={
                filtered
                  ? "Clear a filter to see the other threads."
                  : "Open a terminal or launch a run. Their sessions appear here."
              }
            />
          </CenteredState>
        ) : (
          <ConversationList
            sections={sections}
            selectedId={selected?.id ?? null}
            pending={mark.isPending}
            onMark={markEntry}
          />
        );
      }}
    </QueryBoundary>
  );

  const selectedTerminal =
    selected !== undefined && "terminal" in selected ? selected.terminal : undefined;
  let thread: ReactNode = null;
  if (terminal !== undefined)
    thread = selectedTerminal ? (
      <TerminalConversationBody
        key={`${hostUrl}:${token}:${selectedTerminal.id}`}
        session={selectedTerminal}
      />
    ) : (
      <QueryBoundary
        query={conversations}
        pending={<ListSkeleton rows={3} height={40} />}
        error={
          <ErrorReport
            error={conversations.error}
            context="Couldn’t load conversations"
            onRetry={() => void conversations.refetch()}
          />
        }
      >
        {() => (
          <CenteredState>
            <EmptyState
              icon="terminal"
              title="Terminal session not found"
              description="This session is no longer listed on this host."
            />
          </CenteredState>
        )}
      </QueryBoundary>
    );
  else if (run !== undefined && step !== undefined)
    thread = (
      <RunEventsProvider runId={run}>
        <ConversationThreadBody runId={run} stepRunId={step} />
      </RunEventsProvider>
    );

  if (thread !== null)
    return (
      <RouteShell
        titleIcon="message-square"
        breadcrumbs={[
          {
            label: selected === undefined ? "Conversation" : conversationTitle(selected),
            current: true,
          },
        ]}
        back={{ label: "All conversations", goBack: closeThread }}
      >
        {thread}
      </RouteShell>
    );

  return (
    <RouteShell
      titleIcon="message-square"
      titleNote="Cockpit chats and terminal sessions on this host."
      breadcrumbs={[{ label: "Conversations", current: true }]}
      actions={
        <ConversationFiltersMenu
          filters={filters}
          projects={conversationProjectOptions(entries)}
          onChange={setFilters}
        />
      }
    >
      <div className="mx-auto h-full max-w-5xl overflow-auto">{list}</div>
    </RouteShell>
  );
}
