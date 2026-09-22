import type { ConversationEntry } from "@otomat/domain";
import {
  EmptyState,
  ResizablePanel,
  ResizablePanelGroup,
  SidePanel,
  useMediaQuery,
  usePanelGroupLayout,
  WIDE_VIEWPORT_MEDIA_QUERY,
} from "@otomat/ui";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMarkConversations } from "@web/api/conversations/mutations";
import { useConversations } from "@web/api/conversations/queries";
import { useConversationsStream } from "@web/api/conversations/use-conversations-stream";
import { RunEventsProvider } from "@web/api/runs/run-events-provider";
import { ConversationFiltersMenu } from "@web/components/conversations/filters-menu";
import { ConversationList } from "@web/components/conversations/list";
import { ConversationThreadBody } from "@web/components/conversations/thread-body";
import { useMarkConversationSeen } from "@web/components/conversations/use-mark-seen";
import { ErrorReport } from "@web/components/diagnostics/error-report";
import { CenteredState } from "@web/components/shell/centered-state";
import { ListSkeleton } from "@web/components/shell/list-skeleton";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { RouteShell } from "@web/components/shell/route-shell";
import {
  activeConversationFilterCount,
  applyConversationFilters,
  conversationProjectOptions,
  NO_CONVERSATION_FILTERS,
} from "@web/lib/conversations/filters";
import { groupConversations } from "@web/lib/conversations/sections";
import { markInboxRequest, type InboxMarkPatch } from "@web/lib/inbox/marks";
import { useState } from "react";

export function ConversationsView() {
  useConversationsStream();
  const conversations = useConversations();
  const mark = useMarkConversations();
  const { run, step } = useSearch({ from: "/conversations" });
  const navigate = useNavigate();
  const wide = useMediaQuery(WIDE_VIEWPORT_MEDIA_QUERY);
  const panesLayout = usePanelGroupLayout("otomat.conversations");
  const [filters, setFilters] = useState(NO_CONVERSATION_FILTERS);
  const filtered = activeConversationFilterCount(filters) > 0;

  const entries = conversations.data?.entries ?? [];
  const selected = entries.find((entry) => entry.step_run_id === step);
  useMarkConversationSeen(selected, mark.mutate);

  const markEntry = (entry: ConversationEntry, patch: InboxMarkPatch): void => {
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
                  : "Launch a run from an issue and its step conversations appear here."
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

  const thread =
    run === undefined || step === undefined ? (
      <CenteredState>
        <EmptyState
          icon="message-square"
          title="Select a conversation"
          description="Its thread opens here, with the composer already aimed at that step."
        />
      </CenteredState>
    ) : (
      <RunEventsProvider runId={run}>
        <ConversationThreadBody runId={run} stepRunId={step} />
      </RunEventsProvider>
    );

  return (
    <RouteShell
      titleIcon="message-square"
      titleNote="Read and answer the step conversations of every project on this host."
      breadcrumbs={[{ label: "Conversations", current: true }]}
      back={
        !wide && step !== undefined ? { label: "Back to conversations", goBack: closeThread } : null
      }
      actions={
        <ConversationFiltersMenu
          filters={filters}
          projects={conversationProjectOptions(entries)}
          onChange={setFilters}
        />
      }
    >
      {wide ? (
        <ResizablePanelGroup {...panesLayout} className="h-full min-h-0">
          <SidePanel
            id="conversations-list"
            label="Conversations"
            side="left"
            defaultSize={380}
            minSize={300}
            maxSize="45%"
          >
            <div className="h-full min-h-0 overflow-auto">{list}</div>
          </SidePanel>
          <ResizablePanel id="conversation-thread" minSize="40%">
            {thread}
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <div className="flex h-full min-h-0 flex-col overflow-auto">
          {step === undefined ? list : thread}
        </div>
      )}
    </RouteShell>
  );
}
