import { ErrorState, Icon, IconButton, Pill, PillTabs, Skeleton } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { useRunDetail } from "@web/api/runs/queries";
import { useRunEventStream } from "@web/api/runs/run-event-stream";
import { ConversationHeader } from "@web/components/runs/conversation/header";
import { StepConversationThread } from "@web/components/runs/conversation/step-thread";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { selectedStepRunId } from "@web/lib/run/plan";

export function ConversationSection({
  runId,
  selectedStepId,
  onSelectStep,
}: {
  runId: string;
  selectedStepId: string | null;
  onSelectStep: (stepId: string) => void;
}) {
  const detail = useRunDetail(runId);
  const stream = useRunEventStream();

  return (
    <QueryBoundary
      query={detail}
      pending={<Skeleton height={44} />}
      error={
        <ErrorState
          variant="inline"
          title="Couldn’t load this run"
          onRetry={() => void detail.refetch()}
        />
      }
    >
      {(data) => {
        const selected = selectedStepRunId(data, stream.events, selectedStepId ?? undefined);
        if (selected === null) return null;
        const step = data.steps.find((candidate) => candidate.id === selected);
        return (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center gap-2 border-b border-border-subtle p-2">
              <div className="min-w-0 flex-1 overflow-x-auto">
                <PillTabs
                  type="single"
                  value={selected}
                  onValueChange={(value) => {
                    if (value !== "") onSelectStep(value);
                  }}
                  aria-label="Step conversations"
                >
                  {data.steps
                    .toSorted((left, right) => left.idx - right.idx)
                    .map((entry) => (
                      <Pill key={entry.id} value={entry.id}>
                        {entry.name}
                      </Pill>
                    ))}
                </PillTabs>
              </div>
              <IconButton
                label={`Open cockpit · ${step?.name ?? "Conversation"}`}
                icon={<Icon name="monitor" aria-hidden />}
                nativeButton={false}
                role="link"
                render={<Link to="/runs/$runId" params={{ runId }} search={{ step: selected }} />}
              />
            </div>
            <ConversationHeader detail={data} stepRunId={selected} />
            <StepConversationThread detail={data} stream={stream} stepRunId={selected} />
          </div>
        );
      }}
    </QueryBoundary>
  );
}
