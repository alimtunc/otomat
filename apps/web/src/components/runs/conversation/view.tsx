import {
  ResizablePanel,
  ResizablePanelGroup,
  SidePanel,
  Skeleton,
  useMediaQuery,
  usePanelGroupLayout,
  WIDE_VIEWPORT_MEDIA_QUERY,
} from "@otomat/ui";
import { useParams } from "@tanstack/react-router";
import { useRunDetail } from "@web/api/runs/queries";
import { useRunEventStream } from "@web/api/runs/run-event-stream";
import { ErrorReport } from "@web/components/diagnostics/error-report";
import { ContextPane } from "@web/components/runs/cockpit/context-pane";
import { ContextStrip } from "@web/components/runs/cockpit/context-strip";
import { StepsDisclosure } from "@web/components/runs/cockpit/steps/disclosure";
import { StepsPane } from "@web/components/runs/cockpit/steps/pane";
import { CompeteComparison } from "@web/components/runs/compete/comparison";
import { ConversationThread } from "@web/components/runs/conversation/thread";
import { PaneHeader } from "@web/components/runs/pane-header";
import { QueryBoundary } from "@web/components/shell/query-boundary";

export function RunConversationView() {
  const { runId } = useParams({ from: "/runs/$runId/" });
  const detail = useRunDetail(runId);
  const stream = useRunEventStream();
  const wide = useMediaQuery(WIDE_VIEWPORT_MEDIA_QUERY);
  const panesLayout = usePanelGroupLayout("otomat.run-conversation");

  return (
    <QueryBoundary
      query={detail}
      pending={
        <div className="flex flex-col gap-2 p-6">
          <Skeleton height={20} width="40%" />
          <Skeleton height={14} width="64%" />
        </div>
      }
      error={
        <ErrorReport
          error={detail.error}
          context="Couldn’t load this run"
          onRetry={() => void detail.refetch()}
        />
      }
    >
      {(data) => {
        const activeCompetition = data.compete_groups.find(
          (group) => group.status === "awaiting_selection" || group.status === "promoting",
        );

        const middle = activeCompetition ? (
          <CompeteComparison detail={data} group={activeCompetition} events={stream.events} />
        ) : (
          <>
            <PaneHeader>
              Conversation
              <span className="ml-auto font-normal normal-case text-text-tertiary">
                {stream.state === "open" ? "ordered by seq · live" : "ordered by seq"}
              </span>
            </PaneHeader>
            <ConversationThread detail={data} stream={stream} />
          </>
        );

        if (!wide) {
          return (
            <div className="flex h-full min-h-0 flex-col">
              <ContextStrip detail={data} />
              <StepsDisclosure detail={data} />
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">{middle}</div>
            </div>
          );
        }

        return (
          <ResizablePanelGroup {...panesLayout} className="h-full min-h-0">
            <SidePanel
              id="run-steps"
              label="Steps"
              side="left"
              defaultSize={226}
              minSize={180}
              maxSize="30%"
            >
              <StepsPane detail={data} />
            </SidePanel>
            <ResizablePanel id="conversation" minSize="30%">
              {middle}
            </ResizablePanel>
            <SidePanel
              id="run-context"
              label="Run context"
              side="right"
              defaultSize={270}
              minSize={220}
              maxSize="34%"
            >
              <ContextPane detail={data} />
            </SidePanel>
          </ResizablePanelGroup>
        );
      }}
    </QueryBoundary>
  );
}
