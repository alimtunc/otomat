import { EmptyState, Icon, Skeleton } from "@otomat/ui";
import { useRunDetail } from "@web/api/runs/queries";
import { useRunEventStream } from "@web/api/runs/run-event-stream";
import { ErrorReport } from "@web/components/diagnostics/error-report";
import { ConversationHeader } from "@web/components/runs/conversation/header";
import { StepConversationThread } from "@web/components/runs/conversation/step-thread";
import { PaneHeader } from "@web/components/runs/pane-header";
import { CenteredState } from "@web/components/shell/centered-state";
import { IconLink } from "@web/components/shell/icon-link";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { STREAM_LABEL } from "@web/lib/run/stream";

export interface ConversationThreadBodyProps {
  runId: string;
  stepRunId: string;
}

export function ConversationThreadBody({ runId, stepRunId }: ConversationThreadBodyProps) {
  const detail = useRunDetail(runId);
  const stream = useRunEventStream();

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
          context="Couldn’t load this conversation"
          onRetry={() => void detail.refetch()}
        />
      }
    >
      {(data) => {
        const step = data.steps.find((candidate) => candidate.id === stepRunId);
        if (step === undefined) {
          return (
            <CenteredState>
              <EmptyState
                icon="message-square"
                title="This conversation is not on this host"
                description="The step is not part of a run the connected daemon knows."
              />
            </CenteredState>
          );
        }
        return (
          <div className="flex h-full min-h-0 flex-col">
            <PaneHeader>
              <Icon name="monitor" role="img" aria-label="Cockpit chat" />
              <span className="truncate">{step.name}</span>
              {stream.state === "open" ? (
                <span className="font-normal normal-case text-text-tertiary">
                  {STREAM_LABEL.open}
                </span>
              ) : null}
              <span className="ml-auto flex items-center">
                {data.run.issue_id === null ? null : (
                  <IconLink
                    to="/issues/$issueId"
                    params={{ issueId: data.run.issue_id }}
                    search={{ run: runId, step: stepRunId }}
                    label="Open issue"
                    icon={<Icon name="list-todo" aria-hidden />}
                  />
                )}
                <IconLink
                  to="/runs/$runId"
                  params={{ runId }}
                  search={{ step: stepRunId }}
                  label="Open cockpit"
                  icon={<Icon name="monitor" aria-hidden />}
                />
              </span>
            </PaneHeader>
            <ConversationHeader detail={data} stepRunId={stepRunId} />
            <StepConversationThread detail={data} stream={stream} stepRunId={stepRunId} />
          </div>
        );
      }}
    </QueryBoundary>
  );
}
